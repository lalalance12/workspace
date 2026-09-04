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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      desks: {
        Row: {
          created_at: string
          grid_h: number
          grid_w: number
          grid_x: number
          grid_y: number
          id: string
          label: string
          profile_id: string | null
          room: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          grid_h?: number
          grid_w?: number
          grid_x?: number
          grid_y?: number
          id?: string
          label: string
          profile_id?: string | null
          room?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          grid_h?: number
          grid_w?: number
          grid_x?: number
          grid_y?: number
          id?: string
          label?: string
          profile_id?: string | null
          room?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          href: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          nudge_id: string | null
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          nudge_id?: string | null
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          nudge_id?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_nudge_id_fkey"
            columns: ["nudge_id"]
            isOneToOne: false
            referencedRelation: "nudges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nudges: {
        Row: {
          context_status_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["nudge_kind"]
          link: string | null
          note: string | null
          question: string | null
          recipient_id: string
          resolved_at: string | null
          resolved_by_status_id: string | null
          sender_id: string | null
          state: Database["public"]["Enums"]["nudge_state"]
          team_id: string
        }
        Insert: {
          context_status_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["nudge_kind"]
          link?: string | null
          note?: string | null
          question?: string | null
          recipient_id: string
          resolved_at?: string | null
          resolved_by_status_id?: string | null
          sender_id?: string | null
          state?: Database["public"]["Enums"]["nudge_state"]
          team_id: string
        }
        Update: {
          context_status_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["nudge_kind"]
          link?: string | null
          note?: string | null
          question?: string | null
          recipient_id?: string
          resolved_at?: string | null
          resolved_by_status_id?: string | null
          sender_id?: string | null
          state?: Database["public"]["Enums"]["nudge_state"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_context_status_id_fkey"
            columns: ["context_status_id"]
            isOneToOne: false
            referencedRelation: "status_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_resolved_by_status_id_fkey"
            columns: ["resolved_by_status_id"]
            isOneToOne: false
            referencedRelation: "status_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          message_link: string | null
          nudges_paused_until: string | null
          peer_nudges_enabled: boolean
          role: Database["public"]["Enums"]["team_role"]
          system_nudges_enabled: boolean
          team_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          message_link?: string | null
          nudges_paused_until?: string | null
          peer_nudges_enabled?: boolean
          role?: Database["public"]["Enums"]["team_role"]
          system_nudges_enabled?: boolean
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          message_link?: string | null
          nudges_paused_until?: string | null
          peer_nudges_enabled?: boolean
          role?: Database["public"]["Enums"]["team_role"]
          system_nudges_enabled?: boolean
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_picks: {
        Row: {
          id: string
          last_used_at: string
          note: string | null
          profile_id: string
          state: Database["public"]["Enums"]["status_state"]
          ticket_ref: string | null
          use_count: number
        }
        Insert: {
          id?: string
          last_used_at?: string
          note?: string | null
          profile_id: string
          state: Database["public"]["Enums"]["status_state"]
          ticket_ref?: string | null
          use_count?: number
        }
        Update: {
          id?: string
          last_used_at?: string
          note?: string | null
          profile_id?: string
          state?: Database["public"]["Enums"]["status_state"]
          ticket_ref?: string | null
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quick_picks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_updates: {
        Row: {
          auto_switch_to: Database["public"]["Enums"]["status_state"] | null
          created_at: string
          custom_label: string | null
          details: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          note: string | null
          profile_id: string
          started_at: string
          state: Database["public"]["Enums"]["status_state"]
          team_id: string
          ticket_ref: string | null
        }
        Insert: {
          auto_switch_to?: Database["public"]["Enums"]["status_state"] | null
          created_at?: string
          custom_label?: string | null
          details?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          note?: string | null
          profile_id: string
          started_at?: string
          state: Database["public"]["Enums"]["status_state"]
          team_id: string
          ticket_ref?: string | null
        }
        Update: {
          auto_switch_to?: Database["public"]["Enums"]["status_state"] | null
          created_at?: string
          custom_label?: string | null
          details?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          note?: string | null
          profile_id?: string
          started_at?: string
          state?: Database["public"]["Enums"]["status_state"]
          team_id?: string
          ticket_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_updates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          peer_nudges_per_hour: number
          peer_nudges_per_recipient_per_hour: number
          renudge_after_minutes: number
          stale_after_minutes: number
          system_nudges_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string
          name: string
          peer_nudges_per_hour?: number
          peer_nudges_per_recipient_per_hour?: number
          renudge_after_minutes?: number
          stale_after_minutes?: number
          system_nudges_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          peer_nudges_per_hour?: number
          peer_nudges_per_recipient_per_hour?: number
          renudge_after_minutes?: number
          stale_after_minutes?: number
          system_nudges_enabled?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_nudge: {
        Args: { p_nudge_id: string }
        Returns: {
          context_status_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["nudge_kind"]
          link: string | null
          note: string | null
          question: string | null
          recipient_id: string
          resolved_at: string | null
          resolved_by_status_id: string | null
          sender_id: string | null
          state: Database["public"]["Enums"]["nudge_state"]
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nudges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compose_nudge_question: {
        Args: {
          p_note: string
          p_state: Database["public"]["Enums"]["status_state"]
        }
        Returns: string
      }
      create_team: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          id: string
          join_code: string
          name: string
          peer_nudges_per_hour: number
          peer_nudges_per_recipient_per_hour: number
          renudge_after_minutes: number
          stale_after_minutes: number
          system_nudges_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_team_id: { Args: never; Returns: string }
      enqueue_due_nudges: { Args: never; Returns: number }
      expire_due_durations: { Args: never; Returns: number }
      generate_join_code: { Args: never; Returns: string }
      is_team_head: { Args: never; Returns: boolean }
      join_team: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          id: string
          join_code: string
          name: string
          peer_nudges_per_hour: number
          peer_nudges_per_recipient_per_hour: number
          renudge_after_minutes: number
          stale_after_minutes: number
          system_nudges_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_team: { Args: never; Returns: undefined }
      respond_to_nudge: {
        Args: {
          p_note?: string
          p_nudge_id: string
          p_state: Database["public"]["Enums"]["status_state"]
          p_ticket_ref?: string
        }
        Returns: {
          auto_switch_to: Database["public"]["Enums"]["status_state"] | null
          created_at: string
          custom_label: string | null
          details: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          note: string | null
          profile_id: string
          started_at: string
          state: Database["public"]["Enums"]["status_state"]
          team_id: string
          ticket_ref: string | null
        }
        SetofOptions: {
          from: "*"
          to: "status_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rotate_join_code: { Args: never; Returns: string }
      send_peer_nudge: {
        Args: { p_link?: string; p_note?: string; p_recipient_id: string }
        Returns: {
          context_status_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["nudge_kind"]
          link: string | null
          note: string | null
          question: string | null
          recipient_id: string
          resolved_at: string | null
          resolved_by_status_id: string | null
          sender_id: string | null
          state: Database["public"]["Enums"]["nudge_state"]
          team_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nudges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_status: {
        Args: {
          p_auto_switch_to?: Database["public"]["Enums"]["status_state"]
          p_custom_label?: string
          p_details?: string
          p_duration_minutes?: number
          p_note?: string
          p_state: Database["public"]["Enums"]["status_state"]
          p_ticket_ref?: string
        }
        Returns: {
          auto_switch_to: Database["public"]["Enums"]["status_state"] | null
          created_at: string
          custom_label: string | null
          details: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          note: string | null
          profile_id: string
          started_at: string
          state: Database["public"]["Enums"]["status_state"]
          team_id: string
          ticket_ref: string | null
        }
        SetofOptions: {
          from: "*"
          to: "status_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      switch_team: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          id: string
          join_code: string
          name: string
          peer_nudges_per_hour: number
          peer_nudges_per_recipient_per_hour: number
          renudge_after_minutes: number
          stale_after_minutes: number
          system_nudges_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      notification_kind:
        | "peer_nudge"
        | "system_nudge"
        | "nudge_acknowledged"
        | "teammate_blocked"
      nudge_kind: "peer" | "system"
      nudge_state: "open" | "acknowledged" | "resolved"
      status_state:
        | "working"
        | "reviewing"
        | "blocked"
        | "in_meeting"
        | "break"
        | "done_for_day"
        | "off"
        | "other"
      team_role: "head" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      notification_kind: [
        "peer_nudge",
        "system_nudge",
        "nudge_acknowledged",
        "teammate_blocked",
      ],
      nudge_kind: ["peer", "system"],
      nudge_state: ["open", "acknowledged", "resolved"],
      status_state: [
        "working",
        "reviewing",
        "blocked",
        "in_meeting",
        "break",
        "done_for_day",
        "off",
        "other",
      ],
      team_role: ["head", "member"],
    },
  },
} as const
