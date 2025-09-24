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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics: {
        Row: {
          actual_engagement: number | null
          avg_watch_time: number | null
          clip_id: string
          comment_rate: number | null
          comments: number | null
          created_at: string
          fetched_at: string
          id: string
          like_ratio: number | null
          likes: number | null
          normalized_views: number | null
          shares: number | null
          video_id: string
          views: number | null
        }
        Insert: {
          actual_engagement?: number | null
          avg_watch_time?: number | null
          clip_id: string
          comment_rate?: number | null
          comments?: number | null
          created_at?: string
          fetched_at?: string
          id?: string
          like_ratio?: number | null
          likes?: number | null
          normalized_views?: number | null
          shares?: number | null
          video_id: string
          views?: number | null
        }
        Update: {
          actual_engagement?: number | null
          avg_watch_time?: number | null
          clip_id?: string
          comment_rate?: number | null
          comments?: number | null
          created_at?: string
          fetched_at?: string
          id?: string
          like_ratio?: number | null
          likes?: number | null
          normalized_views?: number | null
          shares?: number | null
          video_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          checksum: string | null
          created_at: string
          download_count: number | null
          duration_seconds: number
          end_time: number
          expires_at: string
          file_size_bytes: number | null
          id: string
          job_id: string
          predicted_engagement: number | null
          processing_logs: Json | null
          segment_scores: Json | null
          start_time: number
          status: Database["public"]["Enums"]["clip_status"]
          subtitle_urls: string[] | null
          thumbnail_urls: string[] | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          download_count?: number | null
          duration_seconds: number
          end_time: number
          expires_at?: string
          file_size_bytes?: number | null
          id?: string
          job_id: string
          predicted_engagement?: number | null
          processing_logs?: Json | null
          segment_scores?: Json | null
          start_time: number
          status?: Database["public"]["Enums"]["clip_status"]
          subtitle_urls?: string[] | null
          thumbnail_urls?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          checksum?: string | null
          created_at?: string
          download_count?: number | null
          duration_seconds?: number
          end_time?: number
          expires_at?: string
          file_size_bytes?: number | null
          id?: string
          job_id?: string
          predicted_engagement?: number | null
          processing_logs?: Json | null
          segment_scores?: Json | null
          start_time?: number
          status?: Database["public"]["Enums"]["clip_status"]
          subtitle_urls?: string[] | null
          thumbnail_urls?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          captions_style: Database["public"]["Enums"]["caption_style"] | null
          completed_at: string | null
          created_at: string
          current_stage: string | null
          download_url: string | null
          error_message: string | null
          id: string
          max_clips: number | null
          max_duration: number | null
          min_duration: number | null
          music_enabled: boolean | null
          progress_percent: number | null
          segments_data: Json | null
          sfx_enabled: boolean | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string | null
          transcript_data: Json | null
          updated_at: string
          user_id: string
          video_id: string | null
          youtube_url: string
        }
        Insert: {
          captions_style?: Database["public"]["Enums"]["caption_style"] | null
          completed_at?: string | null
          created_at?: string
          current_stage?: string | null
          download_url?: string | null
          error_message?: string | null
          id?: string
          max_clips?: number | null
          max_duration?: number | null
          min_duration?: number | null
          music_enabled?: boolean | null
          progress_percent?: number | null
          segments_data?: Json | null
          sfx_enabled?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string | null
          transcript_data?: Json | null
          updated_at?: string
          user_id: string
          video_id?: string | null
          youtube_url: string
        }
        Update: {
          captions_style?: Database["public"]["Enums"]["caption_style"] | null
          completed_at?: string | null
          created_at?: string
          current_stage?: string | null
          download_url?: string | null
          error_message?: string | null
          id?: string
          max_clips?: number | null
          max_duration?: number | null
          min_duration?: number | null
          music_enabled?: boolean | null
          progress_percent?: number | null
          segments_data?: Json | null
          sfx_enabled?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string | null
          transcript_data?: Json | null
          updated_at?: string
          user_id?: string
          video_id?: string | null
          youtube_url?: string
        }
        Relationships: []
      }
      learning_weights: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          keyword_weight: number | null
          laughter_weight: number | null
          learning_rate: number | null
          version: number
          visual_change_weight: number | null
          volume_spike_weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          keyword_weight?: number | null
          laughter_weight?: number | null
          learning_rate?: number | null
          version: number
          visual_change_weight?: number | null
          volume_spike_weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          keyword_weight?: number | null
          laughter_weight?: number | null
          learning_rate?: number | null
          version?: number
          visual_change_weight?: number | null
          volume_spike_weight?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_captions_style:
            | Database["public"]["Enums"]["caption_style"]
            | null
          default_music_enabled: boolean | null
          default_sfx_enabled: boolean | null
          display_name: string | null
          id: string
          storage_used_bytes: number | null
          total_clips: number | null
          total_jobs: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_captions_style?:
            | Database["public"]["Enums"]["caption_style"]
            | null
          default_music_enabled?: boolean | null
          default_sfx_enabled?: boolean | null
          display_name?: string | null
          id?: string
          storage_used_bytes?: number | null
          total_clips?: number | null
          total_jobs?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_captions_style?:
            | Database["public"]["Enums"]["caption_style"]
            | null
          default_music_enabled?: boolean | null
          default_sfx_enabled?: boolean | null
          display_name?: string | null
          id?: string
          storage_used_bytes?: number | null
          total_clips?: number | null
          total_jobs?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_old_clips: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      caption_style: "modern" | "bold" | "neon" | "classic"
      clip_status: "processing" | "ready" | "expired" | "failed"
      job_status:
        | "queued"
        | "downloading"
        | "transcribing"
        | "detecting_highlights"
        | "creating_clips"
        | "uploading"
        | "completed"
        | "failed"
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
    Enums: {
      caption_style: ["modern", "bold", "neon", "classic"],
      clip_status: ["processing", "ready", "expired", "failed"],
      job_status: [
        "queued",
        "downloading",
        "transcribing",
        "detecting_highlights",
        "creating_clips",
        "uploading",
        "completed",
        "failed",
      ],
    },
  },
} as const
