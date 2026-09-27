import { NextRequest, NextResponse } from 'next/server';
import { POST as practicePost, GET as practiceGet } from '../duel/practice/route';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return practicePost(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return practiceGet(request);
}
