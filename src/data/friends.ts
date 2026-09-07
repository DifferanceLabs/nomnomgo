import { accountRequest } from './accountStorage';

export type Friend = { id: string; email: string; connectedAt: string };

export async function listFriends() {
  return (await accountRequest<{ friends: Friend[] }>({ action: 'friend.list' })).friends;
}

export async function removeFriend(friendId: string) {
  await accountRequest({ action: 'friend.remove', friendId });
}
