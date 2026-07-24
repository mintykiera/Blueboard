export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      universities: {
        Row: {
          id: string;
          name: string;
          short_code: string;
          email_domain: string;
          theme_color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_code: string;
          email_domain: string;
          theme_color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_code?: string;
          email_domain?: string;
          theme_color?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          university_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          university_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          university_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      blocks: {
        Row: {
          id: string;
          university_id: string;
          name: string;
          invite_code: string;
          canvas_ics_url: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          name: string;
          invite_code?: string;
          canvas_ics_url?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          name?: string;
          invite_code?: string;
          canvas_ics_url?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      block_members: {
        Row: {
          id: string;
          block_id: string;
          profile_id: string;
          role: "beadle" | "student";
          joined_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          profile_id: string;
          role?: "beadle" | "student";
          joined_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          profile_id?: string;
          role?: "beadle" | "student";
          joined_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          block_id: string;
          title: string;
          course_code: string | null;
          due_at: string | null;
          source: "canvas_ics" | "manual";
          canvas_uid: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          title: string;
          course_code?: string | null;
          due_at?: string | null;
          source?: "canvas_ics" | "manual";
          canvas_uid?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          title?: string;
          course_code?: string | null;
          due_at?: string | null;
          source?: "canvas_ics" | "manual";
          canvas_uid?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_task_completions: {
        Row: {
          id: string;
          task_id: string;
          profile_id: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          profile_id: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          profile_id?: string;
          completed_at?: string;
        };
      };
      beadle_announcements: {
        Row: {
          id: string;
          block_id: string;
          author_id: string;
          content: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          author_id: string;
          content: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          author_id?: string;
          content?: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      block_links: {
        Row: {
          id: string;
          block_id: string;
          title: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          title: string;
          url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          title?: string;
          url?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      current_user_university_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_beadle_of: {
        Args: { p_block_id: string };
        Returns: boolean;
      };
      is_member_of: {
        Args: { p_block_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
