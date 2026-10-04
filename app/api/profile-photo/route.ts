import { authorize } from '@/lib/server-auth';
import { apiError } from '@/lib/server-services';
import { storeProfilePhoto } from '@/lib/profile-photo';

export async function POST(request: Request) {
  try {
    const { user } = await authorize(request);
    if (Number(request.headers.get('content-length')) > 1048576 + 8192) throw new Error('Choose a photo smaller than 1 MB.');
    const file = (await request.formData()).get('photo');
    if (!(file instanceof File) || !file.size || file.size > 1048576) throw new Error('Choose a photo smaller than 1 MB.');
    const url = await storeProfilePhoto(user.id, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
