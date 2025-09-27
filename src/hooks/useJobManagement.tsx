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
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isCanceled, setIsCanceled] = useState(false);

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

      // Set current job ID and reset canceled state
      setCurrentJobId(data?.job_id || null);
      setIsCanceled(false);

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

  // Cancel current job
  const cancelJob = async (jobId?: string) => {
    const jobToCancel = jobId || currentJobId;
    if (!jobToCancel) return false;

    try {
      // Mark as canceled in database
      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'failed',
          error_message: 'Canceled by user',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobToCancel);

      if (error) {
        console.error('Error canceling job:', error);
        return false;
      }

      // Update local state
      setIsCanceled(true);
      setCurrentJobId(null);
      setIsLoading(false);

      // Show cancellation toast
      toast({
        title: "Clip generation canceled",
        description: "You can start a new video now.",
        variant: "default",
      });

      // Refresh jobs list
      await fetchJobs();
      
      return true;
    } catch (error) {
      console.error('Error canceling job:', error);
      toast({
        title: "Failed to cancel job",
        description: "There was an error canceling the job.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Reset all states (for new video)
  const resetJobState = () => {
    setCurrentJobId(null);
    setIsCanceled(false);
    setIsLoading(false);
  };

  return {
    jobs,
    clips,
    isLoading,
    currentJobId,
    isCanceled,
    createJob,
    cancelJob,
    resetJobState,
    fetchJobs,
    fetchClips
  };
};