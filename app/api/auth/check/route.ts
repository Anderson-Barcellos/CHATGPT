import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
);

export async function GET(request: NextRequest) {
  try {
    // Se autenticação não está habilitada, sempre retorna como autenticado
    if (process.env.AUTH_ENABLED !== 'true') {
      return NextResponse.json({ authenticated: true });
    }
    
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ authenticated: false });
    }
    
    // Verifica o token
    await jwtVerify(token, JWT_SECRET);
    
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}