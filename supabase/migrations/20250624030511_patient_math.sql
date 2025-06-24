/*
  # Fix User Profiles Migration

  This migration ensures the user_profiles table and related functionality exists
  without causing errors if they already exist.

  1. Tables
    - `user_profiles` - User role management table
  
  2. Security
    - Enable RLS on user_profiles table
    - Policies for user profile access control
  
  3. Functions & Triggers
    - Auto-create user profiles on signup
    - Update timestamp trigger
  
  4. Admin Setup
    - Grant admin role to admin@example.com if exists
*/

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_user_id_fkey'
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create policies
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create or replace the new user handler function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant admin role to admin@example.com if the user exists
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Find admin@example.com user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@example.com';
  
  -- If user exists, grant admin role
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id) 
    DO UPDATE SET role = 'admin', updated_at = now();
    
    RAISE NOTICE 'Admin role granted to admin@example.com';
  ELSE
    RAISE NOTICE 'admin@example.com user not found. Please create the user first.';
  END IF;
END $$;