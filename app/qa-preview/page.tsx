import {notFound} from 'next/navigation';
import Preview from '@/components/QaFixture';
export default function Page(){if(process.env.NODE_ENV==='production') notFound();return <Preview/>;}
