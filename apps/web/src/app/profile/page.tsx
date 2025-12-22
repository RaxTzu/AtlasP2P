import { redirect } from 'next/navigation';

// Redirect old /profile route to new /manage
export default function ProfilePage() {
  redirect('/manage');
}
