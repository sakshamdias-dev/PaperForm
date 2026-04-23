-- ============================================================================
-- PaperForm Database Schema
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE (extends auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  school_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_auth FOREIGN KEY (id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON public.users FOR SELECT 
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" 
  ON public.users FOR UPDATE 
  USING (id = auth.uid());

-- ============================================================================
-- 2. PAPERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  school_name VARCHAR(255),
  description TEXT,
  time_limit INTEGER, -- in minutes
  total_marks INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_papers_users FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_papers_user_id ON public.papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_updated_at ON public.papers(updated_at DESC);

ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

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
-- 3. SECTIONS TABLE (sections within a paper)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Section',
  instruction TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_papers FOREIGN KEY (paper_id)
    REFERENCES public.papers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sections_paper_id ON public.sections(paper_id);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies (inherit from papers - if user can access paper, they can access its sections)
CREATE POLICY "Users can view sections of their own papers"
  ON public.sections FOR SELECT
  USING (paper_id IN (
    SELECT id FROM public.papers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create sections"
  ON public.sections FOR INSERT
  WITH CHECK (paper_id IN (
    SELECT id FROM public.papers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update sections of their own papers"
  ON public.sections FOR UPDATE
  USING (paper_id IN (
    SELECT id FROM public.papers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete sections of their own papers"
  ON public.sections FOR DELETE
  USING (paper_id IN (
    SELECT id FROM public.papers WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 4. QUESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  section_id UUID, -- can be null for question bank
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL, -- 'mcq', 'short', 'long', 'fillblank'
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT, -- for MCQ: index or text, others: answer text
  marks INTEGER NOT NULL DEFAULT 1,
  subject VARCHAR(255),
  topic VARCHAR(255),
  difficulty VARCHAR(50) DEFAULT 'medium',
  explanation TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_users FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_questions_sections FOREIGN KEY (section_id)
    REFERENCES public.sections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON public.questions(section_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own questions"
  ON public.questions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create questions"
  ON public.questions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own questions"
  ON public.questions FOR UPDATE
  USING (user_id = auth.uid());

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

-- Users trigger
DROP TRIGGER IF EXISTS update_users_timestamp ON public.users;
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Papers trigger
DROP TRIGGER IF EXISTS update_papers_timestamp ON public.papers;
CREATE TRIGGER update_papers_timestamp BEFORE UPDATE ON public.papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sections trigger
DROP TRIGGER IF EXISTS update_sections_timestamp ON public.sections;
CREATE TRIGGER update_sections_timestamp BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Questions trigger
DROP TRIGGER IF EXISTS update_questions_timestamp ON public.questions;
CREATE TRIGGER update_questions_timestamp BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();