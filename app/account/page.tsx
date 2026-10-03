import AccountPanel from '@/components/AccountPanel';
import { Suspense } from 'react';
import { Page } from '@/components/Shell';
export default function AccountPage() { return <Page><Suspense fallback={<p role="status">Opening your account…</p>}><AccountPanel /></Suspense></Page>; }
