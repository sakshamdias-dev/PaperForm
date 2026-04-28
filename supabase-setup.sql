-- ============================================================================
-- PaperForm Database Schema (New Structure)
-- ============================================================================

-- ============================================================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_auth FOREIGN KEY (id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (id = auth.uid());

-- ============================================================================
-- 2. COURSES TABLE (Reusable course names)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON public.courses(teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_teacher_name ON public.courses(teacher_id, name);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own courses"
  ON public.courses FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can create courses"
  ON public.courses FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Users can update their own courses"
  ON public.courses FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can delete their own courses"
  ON public.courses FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================================
-- 3. SUBJECTS TABLE (Reusable subject names)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subjects_teacher FOREIGN KEY (teacher_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON public.subjects(teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_teacher_name ON public.subjects(teacher_id, name);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subjects"
  ON public.subjects FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can create subjects"
  ON public.subjects FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Users can update their own subjects"
  ON public.subjects FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can delete their own subjects"
  ON public.subjects FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================================
-- 4. CLASSES TABLE (Reusable class/section identifiers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_teacher_name ON public.classes(teacher_id, name);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own classes"
  ON public.classes FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can create classes"
  ON public.classes FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Users can update their own classes"
  ON public.classes FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can delete their own classes"
  ON public.classes FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================================
-- 5. QUESTION PAPERS TABLE (Metadata for each exam)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.question_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qp_code VARCHAR(10) UNIQUE NOT NULL,
  teacher_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  date DATE,
  max_marks INTEGER,
  course_id UUID,
  subject_id UUID,
  class_id UUID,
  instructions TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qp_teacher FOREIGN KEY (teacher_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_qp_course FOREIGN KEY (course_id)
    REFERENCES public.courses(id) ON DELETE SET NULL,
  CONSTRAINT fk_qp_subject FOREIGN KEY (subject_id)
    REFERENCES public.subjects(id) ON DELETE SET NULL,
  CONSTRAINT fk_qp_class FOREIGN KEY (class_id)
    REFERENCES public.classes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_qp_teacher_id ON public.question_papers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_qp_code ON public.question_papers(qp_code);
CREATE INDEX IF NOT EXISTS idx_qp_updated_at ON public.question_papers(updated_at DESC);

ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own question papers"
  ON public.question_papers FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can create question papers"
  ON public.question_papers FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Users can update their own question papers"
  ON public.question_papers FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can delete their own question papers"
  ON public.question_papers FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================================
-- 6. QUESTIONS LIBRARY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  content TEXT NOT NULL,
  course_id UUID,
  subject_id UUID,
  class_id UUID,
  question_type VARCHAR(50) NOT NULL DEFAULT 'short', -- 'mcq', 'short', 'long', 'fillblank'
  options JSONB DEFAULT '[]'::jsonb,
  difficulty VARCHAR(50) DEFAULT 'medium',
  explanation TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_teacher FOREIGN KEY (teacher_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_questions_course FOREIGN KEY (course_id)
    REFERENCES public.courses(id) ON DELETE SET NULL,
  CONSTRAINT fk_questions_subject FOREIGN KEY (subject_id)
    REFERENCES public.subjects(id) ON DELETE SET NULL,
  CONSTRAINT fk_questions_class FOREIGN KEY (class_id)
    REFERENCES public.classes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_teacher_id ON public.questions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_course_id ON public.questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_class_id ON public.questions(class_id);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own questions"
  ON public.questions FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can create questions"
  ON public.questions FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Users can update their own questions"
  ON public.questions FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Users can delete their own questions"
  ON public.questions FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================================
-- 7. PAPER_QUESTIONS JUNCTION TABLE
-- ============================================================================

CREATE TYPE paper_section AS ENUM ('A', 'B', 'C', 'D');

CREATE TABLE IF NOT EXISTS public.paper_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL,
  question_id UUID NOT NULL,
  section VARCHAR(1) NOT NULL DEFAULT 'A',
  marks INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pq_paper FOREIGN KEY (paper_id)
    REFERENCES public.question_papers(id) ON DELETE CASCADE,
  CONSTRAINT fk_pq_question FOREIGN KEY (question_id)
    REFERENCES public.questions(id) ON DELETE CASCADE,
  CONSTRAINT uk_paper_question UNIQUE (paper_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_pq_paper_id ON public.paper_questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_pq_question_id ON public.paper_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_pq_section ON public.paper_questions(section);
CREATE INDEX IF NOT EXISTS idx_pq_order ON public.paper_questions(order_index);

ALTER TABLE public.paper_questions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can access questions in papers they own
CREATE POLICY "Users can view paper questions"
  ON public.paper_questions FOR SELECT
  USING (paper_id IN (
    SELECT id FROM public.question_papers WHERE teacher_id = auth.uid()
  ));

CREATE POLICY "Users can create paper questions"
  ON public.paper_questions FOR INSERT
  WITH CHECK (paper_id IN (
    SELECT id FROM public.question_papers WHERE teacher_id = auth.uid()
  ));

CREATE POLICY "Users can update paper questions"
  ON public.paper_questions FOR UPDATE
  USING (paper_id IN (
    SELECT id FROM public.question_papers WHERE teacher_id = auth.uid()
  ));

CREATE POLICY "Users can delete paper questions"
  ON public.paper_questions FOR DELETE
  USING (paper_id IN (
    SELECT id FROM public.question_papers WHERE teacher_id = auth.uid()
  ));

-- ============================================================================
-- 8. TRIGGERS (Auto-update timestamp)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles trigger
DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Courses trigger
DROP TRIGGER IF EXISTS update_courses_timestamp ON public.courses;
CREATE TRIGGER update_courses_timestamp BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Subjects trigger
DROP TRIGGER IF EXISTS update_subjects_timestamp ON public.subjects;
CREATE TRIGGER update_subjects_timestamp BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Classes trigger
DROP TRIGGER IF EXISTS update_classes_timestamp ON public.classes;
CREATE TRIGGER update_classes_timestamp BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Question Papers trigger
DROP TRIGGER IF EXISTS update_qp_timestamp ON public.question_papers;
CREATE TRIGGER update_qp_timestamp BEFORE UPDATE ON public.question_papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Questions trigger
DROP TRIGGER IF EXISTS update_questions_timestamp ON public.questions;
CREATE TRIGGER update_questions_timestamp BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Paper Questions trigger
DROP TRIGGER IF EXISTS update_pq_timestamp ON public.paper_questions;
CREATE TRIGGER update_pq_timestamp BEFORE UPDATE ON public.paper_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 9. AUTO-GENERATE QP_CODE (QPXXXX format)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_qp_code()
RETURNS TRIGGER AS $$
DECLARE
  code_part TEXT;
  random_digits TEXT;
BEGIN
  -- Generate 4 random digits
  random_digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  code_part := 'QP' || random_digits;
  
  -- Check for uniqueness, retry if needed (max 10 attempts)
  FOR i IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.question_papers WHERE qp_code = code_part) THEN
      NEW.qp_code := code_part;
      RETURN NEW;
    END IF;
    random_digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    code_part := 'QP' || random_digits;
  END LOOP;
  
  -- If all attempts failed, use UUID short form
  NEW.qp_code := 'QP' || LEFT(NEW.id::TEXT, 4);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_qp_code_trigger ON public.question_papers;
CREATE TRIGGER generate_qp_code_trigger 
  BEFORE INSERT ON public.question_papers
  FOR EACH ROW EXECUTE FUNCTION generate_qp_code();

-- ============================================================================
-- 10. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'Teacher'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 11. HELPER FUNCTIONS
-- ============================================================================

-- Get total marks for a question paper
CREATE OR REPLACE FUNCTION get_paper_total_marks(p_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COALESCE(SUM(marks), 0) INTO total
  FROM public.paper_questions
  WHERE paper_id = p_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Get questions count for a question paper
CREATE OR REPLACE FUNCTION get_paper_questions_count(p_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_val
  FROM public.paper_questions
  WHERE paper_id = p_id;
  RETURN count_val;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. DEFAULT DATA (Sample courses, subjects, classes)
-- ============================================================================

-- Note: Teachers can insert their own default data after signup
-- Example insert (will be done via the app):
-- INSERT INTO public.courses (teacher_id, name) VALUES (auth.uid(), 'B.Tech');
-- INSERT INTO public.subjects (teacher_id, name) VALUES (auth.uid(), 'Physics');
-- INSERT INTO public.classes (teacher_id, name) VALUES (auth.uid(), 'Section A');