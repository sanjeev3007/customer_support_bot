import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

/**
 * Handle POST requests for user registration.
 * Path: /api/auth/register
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required fields.' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Password strength check (min 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email address already exists.' },
        { status: 400 }
      );
    }

    // Count existing users
    const totalUsers = await prisma.user.count();

    // The first user registering is automatically elevated to ADMIN
    // Otherwise, we default to the role requested (if CUSTOMER or ADMIN) or default to CUSTOMER
    let assignedRole: 'ADMIN' | 'CUSTOMER' = 'CUSTOMER';
    if (totalUsers === 0) {
      assignedRole = 'ADMIN';
    } else if (role === 'ADMIN' || role === 'CUSTOMER') {
      assignedRole = role;
    }

    const hashedPassword = hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        role: assignedRole,
      },
    });

    return NextResponse.json(
      {
        message: 'Registration successful.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration.' },
      { status: 500 }
    );
  }
}
