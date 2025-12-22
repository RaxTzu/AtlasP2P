import { redirect } from 'next/navigation';

// Redirect old /my-nodes route to new /manage/nodes
export default function MyNodesPage() {
  redirect('/manage/nodes');
}
