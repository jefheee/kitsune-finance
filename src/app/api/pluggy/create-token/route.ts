import { NextResponse } from 'next/server';
import { POST as connectTokenHandler } from '../connect-token/route';

export async function POST(request: Request) {
  return connectTokenHandler(request);
}
