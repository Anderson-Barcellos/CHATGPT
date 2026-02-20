import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
);

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Verifica se autenticação está habilitada
    if (process.env.AUTH_ENABLED !== 'true') {
      return NextResponse.json({ success: true });
    }
    
    // Verifica a senha
    const correctPassword = process.env.AUTH_PASSWORD;
    
    if (!correctPassword) {
      return NextResponse.json(
        { error: 'Autenticação configurada incorretamente' },
        { status: 500 }
      );
    }
    
    if (password !== correctPassword) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      );
    }
    
    // Cria o token JWT
    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(JWT_SECRET);
    
    // Cria a resposta com o cookie
    const response = NextResponse.json({ success: true });
    
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}