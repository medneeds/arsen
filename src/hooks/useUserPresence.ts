import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface OnlineUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  hospital_unit: string | null;
  online_at: string;
  last_activity: string;
  current_route: string | null;
}

interface PresenceState {
  [key: string]: OnlineUser[];
}

export function useUserPresence() {
  const { user, role } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastActivityRef = useRef<string>(new Date().toISOString());

  // Update last activity on user interactions
  const updateActivity = useCallback(() => {
    lastActivityRef.current = new Date().toISOString();
  }, []);

  useEffect(() => {
    // Track user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  useEffect(() => {
    if (!user) return;

    const setupPresence = async () => {
      // Get user profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      // Get user departments
      const { data: departments } = await supabase
        .from("user_departments")
        .select("department")
        .eq("user_id", user.id);

      // Get user hospital assignments
      const { data: hospitalAssignments } = await supabase
        .from("user_hospital_assignments")
        .select("hospital_unit_id, hospital_units(name)")
        .eq("user_id", user.id);

      const channel = supabase.channel("online-users", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState() as PresenceState;
          const users: OnlineUser[] = [];

          Object.entries(state).forEach(([, presences]) => {
            if (presences && presences.length > 0) {
              users.push(presences[0]);
            }
          });

          setOnlineUsers(users);
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          console.log("User joined:", newPresences);
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          console.log("User left:", leftPresences);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            const userPresence: OnlineUser = {
              id: user.id,
              full_name: profile?.full_name || null,
              email: profile?.email || user.email || null,
              role: role || null,
              department: departments?.[0]?.department || null,
              hospital_unit: (hospitalAssignments?.[0] as any)?.hospital_units?.name || null,
              online_at: new Date().toISOString(),
              last_activity: lastActivityRef.current,
              current_route: window.location.pathname,
            };

            await channel.track(userPresence);
            setIsTracking(true);
          }
        });

      // Update presence every 30 seconds
      const intervalId = setInterval(async () => {
        if (channelRef.current) {
          const userPresence: OnlineUser = {
            id: user.id,
            full_name: profile?.full_name || null,
            email: profile?.email || user.email || null,
            role: role || null,
            department: departments?.[0]?.department || null,
            hospital_unit: (hospitalAssignments?.[0] as any)?.hospital_units?.name || null,
            online_at: new Date().toISOString(),
            last_activity: lastActivityRef.current,
            current_route: window.location.pathname,
          };

          await channelRef.current.track(userPresence);
        }
      }, 30000);

      return () => {
        clearInterval(intervalId);
        if (channelRef.current) {
          channelRef.current.unsubscribe();
        }
      };
    };

    const cleanup = setupPresence();

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [user, role]);

  return {
    onlineUsers,
    isTracking,
    onlineCount: onlineUsers.length,
  };
}

// Hook for admin to view all online users without tracking
export function useOnlineUsersMonitor() {
  const { user, role } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!user || !isAdmin) return;

    const channel = supabase.channel("online-users-monitor", {
      config: {
        presence: {
          key: `monitor-${user.id}`,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as PresenceState;
        const users: OnlineUser[] = [];

        Object.entries(state).forEach(([key, presences]) => {
          // Skip monitors
          if (key.startsWith("monitor-")) return;
          
          if (presences && presences.length > 0) {
            users.push(presences[0]);
          }
        });

        setOnlineUsers(users);
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [user, isAdmin]);

  // Statistics
  const stats = {
    total: onlineUsers.length,
    byRole: {
      admin: onlineUsers.filter((u) => u.role === "admin").length,
      medico: onlineUsers.filter((u) => u.role === "medico").length,
      porta: onlineUsers.filter((u) => u.role === "porta").length,
      visitante: onlineUsers.filter((u) => u.role === "visitante").length,
    },
    byDepartment: onlineUsers.reduce((acc, u) => {
      if (u.department) {
        acc[u.department] = (acc[u.department] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    onlineUsers,
    stats,
    isAdmin,
  };
}
