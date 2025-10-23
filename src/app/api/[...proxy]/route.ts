import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL;
const FACE_RECOG_URL = process.env.NEXT_PUBLIC_FACE_RECOG_URL;

async function proxyHandler(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace('/api', '');
  
  const faceRecogRoutes = ['/analyze_image', '/add_face', '/recognize_faces', '/analyze_image_stream'];

  let targetApiBaseUrl;
  
  if (faceRecogRoutes.some(route => path.startsWith(route))) {
    targetApiBaseUrl = FACE_RECOG_URL;
  } else {
    targetApiBaseUrl = FLASK_API_URL;
  }

  if (!targetApiBaseUrl) {
    return NextResponse.json({ error: 'Target API URL is not configured on the server.' }, { status: 500 });
  }

  const finalPath = path.startsWith('/cache/') ? path : `/api${path}`;

  const targetUrl = `${targetApiBaseUrl}${finalPath}${req.nextUrl.search}`;
  
  const headers = new Headers();
  if (req.headers.get('Content-Type')) {
    headers.set('Content-Type', req.headers.get('Content-Type')!);
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      // @ts-ignore
      duplex: 'half', 
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json({ error: 'Error forwarding request to the backend.' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return proxyHandler(req);
}

export async function POST(req: NextRequest) {
  return proxyHandler(req);
}

export async function PUT(req: NextRequest) {
    return proxyHandler(req);
}

export async function DELETE(req: NextRequest) {
    return proxyHandler(req);
}