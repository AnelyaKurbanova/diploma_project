import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authorization = request.headers.get("authorization");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (authorization) {
      headers.Authorization = authorization;
    }

    const upstream = await fetch(`${API_BASE_URL}/submissions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type");

    return new NextResponse(text, {
      status: upstream.status,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
  } catch {
    return NextResponse.json(
      { message: "Submission proxy error" },
      { status: 502 },
    );
  }
}
