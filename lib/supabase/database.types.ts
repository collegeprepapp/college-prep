export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          hours_per_week: number | null
          id: string
          leadership_actions: string | null
          name: string
          sort_order: number
          student_id: string
          updated_at: string
          weeks_per_year: number | null
          years_participated: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          hours_per_week?: number | null
          id?: string
          leadership_actions?: string | null
          name: string
          sort_order?: number
          student_id: string
          updated_at?: string
          weeks_per_year?: number | null
          years_participated?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          hours_per_week?: number | null
          id?: string
          leadership_actions?: string | null
          name?: string
          sort_order?: number
          student_id?: string
          updated_at?: string
          weeks_per_year?: number | null
          years_participated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_tasks: {
        Row: {
          assigned_by: string | null
          audience: string
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          student_id: string
          template_id: string | null
          title: string
        }
        Insert: {
          assigned_by?: string | null
          audience?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          student_id: string
          template_id?: string | null
          title: string
        }
        Update: {
          assigned_by?: string | null
          audience?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          student_id?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "timeline_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      college_applications: {
        Row: {
          added_by: string | null
          admission_rep_email: string | null
          admission_rep_name: string | null
          created_at: string
          date_toured: string | null
          deadline: string | null
          goal_completion_date: string | null
          id: string
          notes: string | null
          other_links: string | null
          recommendation_notes: string | null
          recommendations_needed: number | null
          requires_common_app_essay: boolean
          requires_supplemental_essay: boolean
          resume_link: string | null
          scholarship_amount: number | null
          scholarship_info_link: string | null
          school_name: string
          status: string
          student_id: string
          updated_at: string
          website_link: string | null
        }
        Insert: {
          added_by?: string | null
          admission_rep_email?: string | null
          admission_rep_name?: string | null
          created_at?: string
          date_toured?: string | null
          deadline?: string | null
          goal_completion_date?: string | null
          id?: string
          notes?: string | null
          other_links?: string | null
          recommendation_notes?: string | null
          recommendations_needed?: number | null
          requires_common_app_essay?: boolean
          requires_supplemental_essay?: boolean
          resume_link?: string | null
          scholarship_amount?: number | null
          scholarship_info_link?: string | null
          school_name: string
          status?: string
          student_id: string
          updated_at?: string
          website_link?: string | null
        }
        Update: {
          added_by?: string | null
          admission_rep_email?: string | null
          admission_rep_name?: string | null
          created_at?: string
          date_toured?: string | null
          deadline?: string | null
          goal_completion_date?: string | null
          id?: string
          notes?: string | null
          other_links?: string | null
          recommendation_notes?: string | null
          recommendations_needed?: number | null
          requires_common_app_essay?: boolean
          requires_supplemental_essay?: boolean
          resume_link?: string | null
          scholarship_amount?: number | null
          scholarship_info_link?: string | null
          school_name?: string
          status?: string
          student_id?: string
          updated_at?: string
          website_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "college_applications_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "college_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_versions: {
        Row: {
          content: string
          created_at: string
          essay_id: string
          id: string
          saved_by: string | null
          word_count: number
        }
        Insert: {
          content: string
          created_at?: string
          essay_id: string
          id?: string
          saved_by?: string | null
          word_count: number
        }
        Update: {
          content?: string
          created_at?: string
          essay_id?: string
          id?: string
          saved_by?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "essay_versions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essays: {
        Row: {
          added_by: string | null
          college_application_id: string | null
          content: string
          created_at: string
          essay_type: string
          id: string
          prompt: string | null
          student_id: string
          title: string
          updated_at: string
          word_count: number
        }
        Insert: {
          added_by?: string | null
          college_application_id?: string | null
          content?: string
          created_at?: string
          essay_type?: string
          id?: string
          prompt?: string | null
          student_id: string
          title: string
          updated_at?: string
          word_count?: number
        }
        Update: {
          added_by?: string | null
          college_application_id?: string | null
          content?: string
          created_at?: string
          essay_type?: string
          id?: string
          prompt?: string | null
          student_id?: string
          title?: string
          updated_at?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "essays_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_college_application_id_fkey"
            columns: ["college_application_id"]
            isOneToOne: false
            referencedRelation: "college_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      honors: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          organization_name: string | null
          sort_order: number
          student_id: string
          updated_at: string
          year_earned: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_name?: string | null
          sort_order?: number
          student_id: string
          updated_at?: string
          year_earned?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_name?: string | null
          sort_order?: number
          student_id?: string
          updated_at?: string
          year_earned?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "honors_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honors_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          student_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          student_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          student_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_token: string
          invited_by: string
          parent_profile_id: string | null
          status: string
          student_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          invited_by: string
          parent_profile_id?: string | null
          status?: string
          student_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          invited_by?: string
          parent_profile_id?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_parent_profile_id_fkey"
            columns: ["parent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          school_id: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          role: string
          school_id?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          added_by: string | null
          amount: number | null
          created_at: string
          deadline: string | null
          id: string
          link: string | null
          name: string
          notes: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          amount?: number | null
          created_at?: string
          deadline?: string | null
          id?: string
          link?: string | null
          name: string
          notes?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          amount?: number | null
          created_at?: string
          deadline?: string | null
          id?: string
          link?: string | null
          name?: string
          notes?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_rank: string | null
          created_at: string
          email: string | null
          first_name: string
          gpa: number | null
          graduation_year: number
          id: string
          last_name: string
          profile_id: string | null
          school_id: string
        }
        Insert: {
          class_rank?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          gpa?: number | null
          graduation_year: number
          id?: string
          last_name: string
          profile_id?: string | null
          school_id: string
        }
        Update: {
          class_rank?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          gpa?: number | null
          graduation_year?: number
          id?: string
          last_name?: string
          profile_id?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      test_scores: {
        Row: {
          created_at: string
          id: string
          score: number
          student_id: string
          test_date: string | null
          test_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          score: number
          student_id: string
          test_date?: string | null
          test_type: string
        }
        Update: {
          created_at?: string
          id?: string
          score?: number
          student_id?: string
          test_date?: string | null
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_templates: {
        Row: {
          audience: string
          created_at: string
          description: string | null
          grade_level: number
          icon: string | null
          id: string
          school_id: string
          season: string
          sort_order: number
          title: string
        }
        Insert: {
          audience?: string
          created_at?: string
          description?: string | null
          grade_level: number
          icon?: string | null
          id?: string
          school_id: string
          season: string
          sort_order?: number
          title: string
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string | null
          grade_level?: number
          icon?: string | null
          id?: string
          school_id?: string
          season?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      parent_student_links_safe: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string | null
          invited_by: string | null
          parent_profile_id: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string | null
          invited_by?: string | null
          parent_profile_id?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string | null
          invited_by?: string | null
          parent_profile_id?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_parent_profile_id_fkey"
            columns: ["parent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_student: {
        Args: { target_student_id: string }
        Returns: boolean
      }
      get_my_role: { Args: never; Returns: string }
      get_my_school_id: { Args: never; Returns: string }
      is_linked_parent_of: {
        Args: { target_student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
