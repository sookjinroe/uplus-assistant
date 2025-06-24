/*
  # Fix admin role assignment

  1. Security
    - Update existing admin@example.com user to have admin role
    - Ensure user_profiles table has proper data

  2. Changes
    - Grant admin role to admin@example.com if user exists
    - Create user_profile record if missing
*/

-- Grant admin role to admin@example.com user
DO $$
DECLARE
  admin_user_id uuid;
  profile_exists boolean;
BEGIN
  -- Find admin@example.com user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@example.com';
  
  -- If user exists, check if profile exists
  IF admin_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM user_profiles WHERE user_id = admin_user_id
    ) INTO profile_exists;
    
    -- Create or update profile with admin role
    IF profile_exists THEN
      UPDATE user_profiles 
      SET role = 'admin', updated_at = now()
      WHERE user_id = admin_user_id;
      RAISE NOTICE 'Updated existing profile for admin@example.com to admin role';
    ELSE
      INSERT INTO user_profiles (user_id, role)
      VALUES (admin_user_id, 'admin');
      RAISE NOTICE 'Created new admin profile for admin@example.com';
    END IF;
    
    RAISE NOTICE 'Admin role successfully granted to admin@example.com (ID: %)', admin_user_id;
  ELSE
    RAISE NOTICE 'admin@example.com user not found. Please create the user first.';
  END IF;
END $$;

-- Verify the admin user setup
DO $$
DECLARE
  admin_user_id uuid;
  user_role text;
BEGIN
  SELECT u.id, p.role INTO admin_user_id, user_role
  FROM auth.users u
  LEFT JOIN user_profiles p ON u.id = p.user_id
  WHERE u.email = 'admin@example.com';
  
  IF admin_user_id IS NOT NULL THEN
    RAISE NOTICE 'Verification - User ID: %, Role: %', admin_user_id, COALESCE(user_role, 'NO PROFILE');
  END IF;
END $$;