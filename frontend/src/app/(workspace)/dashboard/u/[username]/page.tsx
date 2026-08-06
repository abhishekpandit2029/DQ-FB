import ProfileView from "@/components/profile/ProfileView";

export default function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  return <ProfileView username={params.username} />;
}
