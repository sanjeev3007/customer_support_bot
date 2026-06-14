import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';

/**
 * Root Landing & Redirection Page.
 * Routes authenticated users to their respective home interfaces
 * and redirects anonymous visitors to the login view.
 */
export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  let user = null;
  if (token) {
    user = await verifyJWT(token);
  }

  if (user) {
    if (user.role === 'ADMIN') {
      redirect('/admin');
    } else {
      redirect('/chat');
    }
  }

  redirect('/login');
}
