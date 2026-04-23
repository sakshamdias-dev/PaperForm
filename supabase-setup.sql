-- ============================================================================
-- 1. CREATE USERS TABLE (extends auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  school_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_auth FOREIGN KEY (id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security (RLS) for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/update their own profile
CREATE POLICY "Users can view their own profile" 
  ON public.users FOR SELECT 
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" 
  ON public.users FOR UPDATE 
  USING (id = auth.uid());

-- ============================================================================
-- 2. CREATE PAPERS TABLE (matches code: flat structure with JSONB blocks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.papers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  blocks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_papers_users FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON public.papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_updated_at ON public.papers(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/modify their own papers
CREATE POLICY "Users can view their own papers"
  ON public.papers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create papers"
  ON public.papers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own papers"
  ON public.papers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own papers"
  ON public.papers FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. CREATE QUESTIONS TABLE (Question Bank - separate from papers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer INTEGER,
  marks INTEGER NOT NULL DEFAULT 1,
  subject VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_users FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/modify their own questions
CREATE POLICY "Users can view their own questions"
  ON public.questions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create questions"
  ON public.questions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own questions"
  ON public.questions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS (Auto-update timestamp)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_timestamp ON public.users;
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_papers_timestamp ON public.papers;
CREATE TRIGGER update_papers_timestamp BEFORE UPDATE ON public.papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();