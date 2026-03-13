from __future__ import annotations

import json
import logging
import asyncio
from typing import Any, Awaitable, Callable, Mapping, Optional

import aio_pika
from aio_pika import ExchangeType, IncomingMessage, Message, RobustChannel, RobustConnection
from aiormq.exceptions import ChannelInvalidStateError

LOGGER = logging.getLogger(__name__)

RequestedHandler = Callable[[str], Awaitable[None]]


class Rabbit:
    """RabbitMQ integration for video worker."""

    def __init__(self, url: str, heartbeat_seconds: int = 300) -> None:
        self._url = url
        self._heartbeat_seconds = heartbeat_seconds
        self._connection: Optional[RobustConnection] = None
        self._channel: Optional[RobustChannel] = None
        self._exchange: Optional[aio_pika.Exchange] = None
        self._queue: Optional[aio_pika.Queue] = None

    async def connect(self) -> None:
        """Connect to RabbitMQ and declare exchange/queue."""

        self._connection = await aio_pika.connect_robust(
            self._url,
            heartbeat=self._heartbeat_seconds,
        )
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=1)

        self._exchange = await self._channel.declare_exchange(
            "video.events", ExchangeType.TOPIC, durable=True
        )
        self._queue = await self._channel.declare_queue(
            "video.worker", durable=True
        )
        await self._queue.bind(self._exchange, routing_key="video.requested")

    async def close(self) -> None:
        if self._connection:
            await self._connection.close()

    async def publish_event(
        self,
        routing_key: str,
        payload: Mapping[str, Any],
    ) -> None:
        """Publish an event to the video.events exchange."""

        if not self._exchange:
            raise RuntimeError("Rabbit not connected")

        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        message = Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        LOGGER.info(
            "Publishing event",
            extra={"routing_key": routing_key},
        )
        await self._exchange.publish(message, routing_key=routing_key)

    async def consume_requested(self, handler: RequestedHandler) -> None:
        """Start consuming video.requested messages and dispatch to handler."""

        if not self._queue:
            raise RuntimeError("Rabbit not connected")

        async def _on_message(message: IncomingMessage) -> None:
            job_id: Optional[str] = None
            try:
                payload = json.loads(message.body.decode("utf-8"))
                job_id = payload.get("job_id")
                if not isinstance(job_id, str):
                    raise ValueError("Payload missing 'job_id' string")
            except Exception as exc:  # noqa: BLE001
                LOGGER.error(
                    "Failed to parse requested message: %s",
                    exc,
                )
                try:
                    await message.ack()
                except ChannelInvalidStateError:
                    LOGGER.warning("Skip ack: channel inactive while parsing message")
                return

            try:
                LOGGER.info(
                    "Received video.requested",
                    extra={"job_id": job_id},
                )
                await handler(job_id)
            except asyncio.CancelledError:
                LOGGER.warning(
                    "Job handling cancelled (connection/channel interruption)",
                    extra={"job_id": job_id},
                )
                return
            except Exception:  # noqa: BLE001
                LOGGER.exception(
                    "Error while handling job",
                    extra={"job_id": job_id},
                )
            finally:
                try:
                    await message.ack()
                except ChannelInvalidStateError:
                    LOGGER.warning(
                        "Skip ack: channel inactive after handling job",
                        extra={"job_id": job_id},
                    )

        await self._queue.consume(_on_message, no_ack=False)

