import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  status: string;
  progress_percent: number;
  current_stage: string;
  youtube_url: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

interface Clip {
  id: string;
  job_id: string;
  title: string;
  duration_seconds: number;
  predicted_engagement: number;
  video_url?: string;
  thumbnail_urls: string[];
  subtitle_urls: string[];
  download_count: number;
  status: string;
  expires_at: string;
  created_at: string;
}

export const useJobManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create a new job
  const createJob = async (jobData: {
    youtube_url: string;
    max_clips: number;
    min_duration: number;
    max_duration: number;
    captions_style: 'modern' | 'bold' | 'neon' | 'classic';
    music_enabled: boolean;
    sfx_enabled: boolean;
  }) => {
    if (!user) return null;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-job', {
        body: jobData
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Job Created!",
        description: "Your video is now being processed. You'll see updates in real-time.",
      });

      // Refresh jobs list
      await fetchJobs();
      
      return data;
    } catch (error: any) {
      console.error('Error creating job:', error);
      toast({
        title: "Failed to create job",
        description: error.message || "There was an error creating your video processing job.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user's jobs
  const fetchJobs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  // Fetch user's clips
  const fetchClips = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setClips(data || []);
    } catch (error) {
      console.error('Error fetching clips:', error);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to job updates
    const jobsChannel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Job update:', payload);
          fetchJobs();
        }
      )
      .subscribe();

    // Subscribe to clips updates
    const clipsChannel = supabase
      .channel('clips-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clips',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Clip update:', payload);
          fetchClips();
        }
      )
      .subscribe();

    // Initial fetch
    fetchJobs();
    fetchClips();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(clipsChannel);
    };
  }, [user]);

  return {
    jobs,
    clips,
    isLoading,
    createJob,
    fetchJobs,
    fetchClips
  };
};