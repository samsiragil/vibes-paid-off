export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          slug: string;
          sort_order: number;
        };
        Insert: {
          slug: string;
          sort_order?: number;
        };
        Update: {
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          project_id: string;
          report_count: number;
          status: Database["public"]["Enums"]["comment_status"];
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          project_id: string;
          report_count?: number;
          status?: Database["public"]["Enums"]["comment_status"];
          user_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
          report_count?: number;
          status?: Database["public"]["Enums"]["comment_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_admin: boolean;
          is_trusted: boolean;
          links: Json;
          location: string | null;
          tip_url: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id: string;
          is_admin?: boolean;
          is_trusted?: boolean;
          links?: Json;
          location?: string | null;
          tip_url?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_admin?: boolean;
          is_trusted?: boolean;
          links?: Json;
          location?: string | null;
          tip_url?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      project_media: {
        Row: {
          bytes: number;
          created_at: string;
          height: number;
          id: string;
          project_id: string;
          r2_key: string;
          sort_order: number;
          width: number;
        };
        Insert: {
          bytes: number;
          created_at?: string;
          height: number;
          id?: string;
          project_id: string;
          r2_key: string;
          sort_order: number;
          width: number;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          height?: number;
          id?: string;
          project_id?: string;
          r2_key?: string;
          sort_order?: number;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_media_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_sessions: {
        Row: {
          challenge: string | null;
          created_at: string;
          duration_hours: number;
          id: string;
          label: string | null;
          project_id: string;
          prompt: string;
          result: string;
          solution: string | null;
          sort_order: number;
        };
        Insert: {
          challenge?: string | null;
          created_at?: string;
          duration_hours: number;
          id?: string;
          label?: string | null;
          project_id: string;
          prompt: string;
          result: string;
          solution?: string | null;
          sort_order: number;
        };
        Update: {
          challenge?: string | null;
          created_at?: string;
          duration_hours?: number;
          id?: string;
          label?: string | null;
          project_id?: string;
          prompt?: string;
          result?: string;
          solution?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_sessions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_tools: {
        Row: {
          project_id: string;
          tool_id: number;
        };
        Insert: {
          project_id: string;
          tool_id: number;
        };
        Update: {
          project_id?: string;
          tool_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_tools_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_tools_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "tools";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          build_time_hours: number;
          category: string;
          comment_count: number;
          content_lang: Database["public"]["Enums"]["content_lang"];
          created_at: string;
          description: string;
          eligible_upvote_count: number;
          id: string;
          key_prompt: string;
          last_checked_at: string | null;
          lessons: string | null;
          link_fail_count: number;
          link_status: Database["public"]["Enums"]["link_status"];
          live_url: string;
          owner_id: string;
          published_at: string | null;
          reject_reason: string | null;
          repo_url: string | null;
          report_count: number;
          reviewed_at: string | null;
          reviewed_by: string | null;
          search: unknown;
          session_count: number;
          slug: string;
          status: Database["public"]["Enums"]["project_status"];
          tagline: string;
          title: string;
          updated_at: string;
          upvote_count: number;
          video_url: string | null;
        };
        Insert: {
          build_time_hours?: number;
          category: string;
          comment_count?: number;
          content_lang?: Database["public"]["Enums"]["content_lang"];
          created_at?: string;
          description?: string;
          eligible_upvote_count?: number;
          id?: string;
          key_prompt: string;
          last_checked_at?: string | null;
          lessons?: string | null;
          link_fail_count?: number;
          link_status?: Database["public"]["Enums"]["link_status"];
          live_url: string;
          owner_id: string;
          published_at?: string | null;
          reject_reason?: string | null;
          repo_url?: string | null;
          report_count?: number;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          search?: unknown;
          session_count?: number;
          slug: string;
          status?: Database["public"]["Enums"]["project_status"];
          tagline: string;
          title: string;
          updated_at?: string;
          upvote_count?: number;
          video_url?: string | null;
        };
        Update: {
          build_time_hours?: number;
          category?: string;
          comment_count?: number;
          content_lang?: Database["public"]["Enums"]["content_lang"];
          created_at?: string;
          description?: string;
          eligible_upvote_count?: number;
          id?: string;
          key_prompt?: string;
          last_checked_at?: string | null;
          lessons?: string | null;
          link_fail_count?: number;
          link_status?: Database["public"]["Enums"]["link_status"];
          live_url?: string;
          owner_id?: string;
          published_at?: string | null;
          reject_reason?: string | null;
          repo_url?: string | null;
          report_count?: number;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          search?: unknown;
          session_count?: number;
          slug?: string;
          status?: Database["public"]["Enums"]["project_status"];
          tagline?: string;
          title?: string;
          updated_at?: string;
          upvote_count?: number;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_category_fkey";
            columns: ["category"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string;
          resolution: string | null;
          resolved: boolean;
          resolved_by: string | null;
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution?: string | null;
          resolved?: boolean;
          resolved_by?: string | null;
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution?: string | null;
          resolved?: boolean;
          resolved_by?: string | null;
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target"];
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tool_suggestions: {
        Row: {
          created_at: string;
          id: string;
          merged_tool_id: number | null;
          name: string;
          project_id: string;
          status: Database["public"]["Enums"]["suggestion_status"];
          suggested_by: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          merged_tool_id?: number | null;
          name: string;
          project_id: string;
          status?: Database["public"]["Enums"]["suggestion_status"];
          suggested_by?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          merged_tool_id?: number | null;
          name?: string;
          project_id?: string;
          status?: Database["public"]["Enums"]["suggestion_status"];
          suggested_by?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tool_suggestions_merged_tool_id_fkey";
            columns: ["merged_tool_id"];
            isOneToOne: false;
            referencedRelation: "tools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tool_suggestions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tool_suggestions_suggested_by_fkey";
            columns: ["suggested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tools: {
        Row: {
          created_at: string;
          description_en: string;
          description_id: string;
          id: number;
          is_active: boolean;
          kind: Database["public"]["Enums"]["tool_kind"];
          logo_url: string | null;
          name: string;
          project_count: number;
          slug: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          description_en?: string;
          description_id?: string;
          id?: never;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["tool_kind"];
          logo_url?: string | null;
          name: string;
          project_count?: number;
          slug: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          description_en?: string;
          description_id?: string;
          id?: never;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["tool_kind"];
          logo_url?: string | null;
          name?: string;
          project_count?: number;
          slug?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      upvotes: {
        Row: {
          created_at: string;
          project_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          project_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          project_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "upvotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "upvotes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_picks: {
        Row: {
          breakdown: Json;
          computed_at: string;
          project_id: string | null;
          score: number | null;
          week_start: string;
        };
        Insert: {
          breakdown?: Json;
          computed_at?: string;
          project_id?: string | null;
          score?: number | null;
          week_start: string;
        };
        Update: {
          breakdown?: Json;
          computed_at?: string;
          project_id?: string | null;
          score?: number | null;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_picks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_edit_project: { Args: { p_project_id: string }; Returns: boolean };
      compute_weekly_pick: {
        Args: { p_now?: string; p_week_start?: string };
        Returns: {
          breakdown: Json;
          computed_at: string;
          project_id: string | null;
          score: number | null;
          week_start: string;
        };
        SetofOptions: {
          from: "*";
          to: "weekly_picks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      eligible_upvotes_for: {
        Args: { p_now?: string; p_project_id: string };
        Returns: number;
      };
      get_home_hero: {
        Args: { p_now?: string };
        Returns: {
          kind: string;
          project_id: string;
          score: number;
          week_start: string;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      is_https_url: { Args: { url: string }; Returns: boolean };
      is_reserved_username: { Args: { name: string }; Returns: boolean };
      is_seasoned_account: {
        Args: { at_time?: string; created_at: string };
        Returns: boolean;
      };
      popular_this_week: {
        Args: { p_limit?: number; p_now?: string };
        Returns: {
          eligible_repliers: number;
          eligible_votes: number;
          project_id: string;
          score: number;
        }[];
      };
      project_scores: {
        Args: { p_from: string; p_now?: string; p_to: string };
        Returns: {
          eligible_repliers: number;
          eligible_votes: number;
          owner_id: string;
          project_id: string;
          published_at: string;
          score: number;
        }[];
      };
      project_search_vector: {
        Args: {
          p_description: string;
          p_id: string;
          p_key_prompt: string;
          p_tagline: string;
          p_title: string;
        };
        Returns: unknown;
      };
      raise_rate_limit: { Args: { resource: string }; Returns: undefined };
      refresh_eligible_upvote_counts: {
        Args: { p_now?: string };
        Returns: number;
      };
      refresh_tool_counts: {
        Args: { p_tool_ids: number[] };
        Returns: undefined;
      };
      reorder_project_media: {
        Args: { p_media_ids: string[]; p_project_id: string };
        Returns: undefined;
      };
      username_available: { Args: { name: string }; Returns: boolean };
      wib_week_start: { Args: { p_at?: string }; Returns: string };
    };
    Enums: {
      comment_status: "visible" | "hidden";
      content_lang: "id" | "en";
      link_status: "live" | "offline" | "archived";
      project_status: "pending" | "published" | "hidden" | "rejected" | "removed";
      report_reason: "spam" | "scam" | "adult_illegal" | "harassment" | "personal_data" | "other";
      report_target: "project" | "comment";
      suggestion_status: "pending" | "merged" | "rejected";
      tool_kind:
        | "ai_agent"
        | "ai_builder"
        | "ai_assistant"
        | "framework"
        | "backend"
        | "hosting"
        | "service";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      comment_status: ["visible", "hidden"],
      content_lang: ["id", "en"],
      link_status: ["live", "offline", "archived"],
      project_status: ["pending", "published", "hidden", "rejected", "removed"],
      report_reason: ["spam", "scam", "adult_illegal", "harassment", "personal_data", "other"],
      report_target: ["project", "comment"],
      suggestion_status: ["pending", "merged", "rejected"],
      tool_kind: [
        "ai_agent",
        "ai_builder",
        "ai_assistant",
        "framework",
        "backend",
        "hosting",
        "service",
      ],
    },
  },
} as const;
