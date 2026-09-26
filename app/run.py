# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Start: HTTP na 8080 (jak dotąd) + HTTPS na 8443 (lokalny certyfikat z app/tls.py) w jednym procesie.
HTTPS_PORT=0 wyłącza HTTPS."""
import asyncio
import logging
import os

import uvicorn


async def main():
    http_port = int(os.getenv("PORT", "8080"))
    https_port = int(os.getenv("HTTPS_PORT", "8443"))
    servers = [uvicorn.Server(uvicorn.Config("app.main:app", host="0.0.0.0", port=http_port, proxy_headers=True))]
    if https_port:
        try:
            from . import tls
            ctx = tls.make_context()
            cfg = uvicorn.Config("app.main:app", host="0.0.0.0", port=https_port, proxy_headers=True, lifespan="off",
                                 ssl_certfile=str(tls.tls_dir() / "server.crt"), ssl_keyfile=str(tls.tls_dir() / "server.key"))
            cfg.load()
            cfg.ssl = ctx            # ten sam kontekst co w tls.py — da się podmienić certyfikat w locie
            servers.append(uvicorn.Server(cfg))
        except Exception:  # noqa: BLE001 — bez HTTPS apka i tak działa
            logging.exception("HTTPS nie wystartował — działa tylko HTTP")
    for s in servers:
        s.install_signal_handlers = lambda: None
    stop = asyncio.Event()
    import signal
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass

    async def stopper():
        await stop.wait()
        for s in servers:
            s.should_exit = True
    await asyncio.gather(stopper(), *(s.serve() for s in servers))


if __name__ == "__main__":
    asyncio.run(main())
