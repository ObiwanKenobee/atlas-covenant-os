REVOKE ALL ON FUNCTION public.accept_admin_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(TEXT) TO authenticated;