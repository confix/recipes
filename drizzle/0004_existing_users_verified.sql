-- Sign-in now requires a confirmed email address (app/lib/auth.server.ts).
-- Every account before this point came through the invite list, so its
-- address was vetted by hand; count it as confirmed rather than lock its
-- owner out until they click a link.
UPDATE `user` SET `email_verified` = 1 WHERE `email_verified` = 0;
