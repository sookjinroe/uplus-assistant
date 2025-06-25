/*
  # Create Admin User Profile

  1. Purpose
    - Ensures that there is at least one admin user in the system
    - Creates a user profile with admin role for the first authenticated user
    - This migration helps resolve the 403 Forbidden admin access errors

  2. Changes
    - Creates a function to automatically assign admin role to the first user
    - Creates a trigger to call this function when a new user profile is created
    - Ensures existing users can be manually promoted to admin

  3. Security
    - Only affects user_profiles table
    - Maintains existing RLS policies
*/

-- Function to handle admin user creation
CREATE OR REPLACE FUNCTION handle_admin_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first user profile being created, make them an admin
  IF (SELECT COUNT(*) FROM user_profiles) = 0 THEN
    NEW.role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profiles
DROP TRIGGER IF EXISTS on_user_profile_created ON user_profiles;
CREATE TRIGGER on_user_profile_created
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_admin_user_creation();

-- Update existing user profiles to admin if no admin exists
DO $$
BEGIN
  -- If no admin users exist, promote the first user to admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE role = 'admin') THEN
    UPDATE user_profiles 
    SET role = 'admin' 
    WHERE id = (
      SELECT id 
      FROM user_profiles 
      ORDER BY created_at ASC 
      LIMIT 1
    );
  END IF;
END $$;