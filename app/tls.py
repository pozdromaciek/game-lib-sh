# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""HTTPS w domowej sieci bez dodatkowych kontenerów.

Aplikacja przy starcie tworzy (raz) własny, lokalny urząd certyfikacji w /data/tls i certyfikat serwera.
Certyfikat CA instaluje się raz na telefonie — wtedy https://<ip>:8443 jest zaufane, a przeglądarka pozwala
na aparat w stronie (getUserMedia działa tylko na HTTPS).

Bezpieczeństwo: CA ma ograniczenie nazw (Name Constraints, krytyczne) — może podpisać WYŁĄCZNIE adresy
prywatne (10/8, 172.16/12, 192.168/16, 127/8) i nazwy .lan / .local / .home.arpa / .internal / localhost.
Nawet gdyby klucz CA wyciekł, nie da się nim podrobić żadnej strony w internecie.
"""
import datetime as dt
import ipaddress
import json
import os
import re
import ssl
import threading
from pathlib import Path
from typing import Optional

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

PRIVATE_NETS = [ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8")]
LOCAL_SUFFIXES = (".lan", ".local", ".home.arpa", ".internal")
_lock = threading.Lock()
_ctx: Optional[ssl.SSLContext] = None


def tls_dir() -> Path:
    d = Path(os.getenv("DATA_DIR", "/data")) / "tls"
    d.mkdir(parents=True, exist_ok=True)
    return d


def allowed_host(h: str) -> bool:
    h = (h or "").strip().lower().rstrip(".")
    if not h or len(h) > 253:
        return False
    try:
        ip = ipaddress.ip_address(h)
        return ip.version == 4 and any(ip in n for n in PRIVATE_NETS)
    except ValueError:
        pass
    if h == "localhost":
        return True
    return bool(re.fullmatch(r"[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*", h)) and h.endswith(LOCAL_SUFFIXES)


def _save_key(path: Path, key) -> None:
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    os.chmod(path, 0o600)


def ensure_ca():
    d = tls_dir()
    kp, cp = d / "ca.key", d / "ca.crt"
    if kp.exists() and cp.exists():
        key = serialization.load_pem_private_key(kp.read_bytes(), None)
        cert = x509.load_pem_x509_certificate(cp.read_bytes())
        if cert.not_valid_after_utc > dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30):
            return key, cert
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Moja kolekcja"),
                      x509.NameAttribute(NameOID.COMMON_NAME, "Moja kolekcja — lokalny CA (tylko sieć domowa)")])
    now = dt.datetime.now(dt.timezone.utc)
    constraints = x509.NameConstraints(
        permitted_subtrees=[x509.IPAddress(n) for n in PRIVATE_NETS]
        + [x509.DNSName(s.lstrip(".")) for s in LOCAL_SUFFIXES] + [x509.DNSName("localhost")],
        excluded_subtrees=None)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - dt.timedelta(minutes=5))
            .not_valid_after(now + dt.timedelta(days=3650))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=True, key_cert_sign=True, crl_sign=True, content_commitment=False,
                                         key_encipherment=False, data_encipherment=False, key_agreement=False,
                                         encipher_only=False, decipher_only=False), critical=True)
            .add_extension(constraints, critical=True)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
            .sign(key, hashes.SHA256()))
    _save_key(kp, key)
    cp.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    for f in ("server.key", "server.crt"):          # nowy CA → nowy certyfikat serwera
        (d / f).unlink(missing_ok=True)
    return key, cert


def hosts() -> list:
    d = tls_dir()
    out = ["localhost", "127.0.0.1"]
    for h in re.split(r"[,\s]+", os.getenv("TLS_HOSTS", "")):
        if allowed_host(h) and h.lower() not in out:
            out.append(h.lower())
    try:
        for h in json.loads((d / "hosts.json").read_text()):
            if allowed_host(h) and h not in out:
                out.append(h)
    except (OSError, ValueError):
        pass
    return out


def _cert_hosts(cert) -> set:
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    except x509.ExtensionNotFound:
        return set()
    return {str(v) for v in san.get_values_for_type(x509.IPAddress)} | set(san.get_values_for_type(x509.DNSName))


def ensure_server_cert() -> tuple:
    ca_key, ca_cert = ensure_ca()
    d = tls_dir()
    kp, cp = d / "server.key", d / "server.crt"
    want = hosts()
    if kp.exists() and cp.exists():
        cert = x509.load_pem_x509_certificate(cp.read_bytes())
        fresh = cert.not_valid_after_utc > dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30)
        if fresh and set(want) <= _cert_hosts(cert) and cert.issuer == ca_cert.subject:
            return str(cp), str(kp)
    key = ec.generate_private_key(ec.SECP256R1())
    san = []
    for h in want:
        try:
            san.append(x509.IPAddress(ipaddress.ip_address(h)))
        except ValueError:
            san.append(x509.DNSName(h))
    now = dt.datetime.now(dt.timezone.utc)
    cert = (x509.CertificateBuilder()
            .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, want[-1])]))
            .issuer_name(ca_cert.subject).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - dt.timedelta(minutes=5)).not_valid_after(now + dt.timedelta(days=397))
            .add_extension(x509.SubjectAlternativeName(san), critical=False)
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=True, key_encipherment=False, key_cert_sign=False, crl_sign=False,
                                         content_commitment=False, data_encipherment=False, key_agreement=False,
                                         encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
            .sign(ca_key, hashes.SHA256()))
    _save_key(kp, key)
    cp.write_bytes(cert.public_bytes(serialization.Encoding.PEM) + ca_cert.public_bytes(serialization.Encoding.PEM))
    return str(cp), str(kp)


def make_context() -> ssl.SSLContext:
    global _ctx
    cert, key = ensure_server_cert()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(cert, key)
    _ctx = ctx
    return ctx


_seen: set = set()


def learn_host(host: str) -> bool:
    """Adres, pod którym ktoś otworzył apkę (np. 192.168.1.20) — dopisz do certyfikatu i przeładuj go w locie."""
    h = (host or "").strip().lower()
    h = h[1:h.index("]")] if h.startswith("[") and "]" in h else h.split(":")[0]
    if h in _seen:
        return False
    _seen.add(h)
    if not allowed_host(h) or h in hosts():
        return False
    with _lock:
        d = tls_dir()
        try:
            known = json.loads((d / "hosts.json").read_text())
        except (OSError, ValueError):
            known = []
        if h in known:
            return False
        known = (known + [h])[-20:]
        (d / "hosts.json").write_text(json.dumps(known))
        cert, key = ensure_server_cert()
        if _ctx is not None:
            _ctx.load_cert_chain(cert, key)     # nowe połączenia dostają nowy certyfikat
    return True


def ca_pem() -> bytes:
    ensure_ca()
    return (tls_dir() / "ca.crt").read_bytes()


def ca_der() -> bytes:
    return x509.load_pem_x509_certificate(ca_pem()).public_bytes(serialization.Encoding.DER)


def ca_fingerprint() -> str:
    c = x509.load_pem_x509_certificate(ca_pem())
    h = c.fingerprint(hashes.SHA256()).hex().upper()
    return ":".join(h[i:i + 2] for i in range(0, len(h), 2))
