import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  user_id: string;
  source_url: string;
  video_id: string | null;
  status: string;
  stage: string | null;
  progress: number;
  metadata: any;
  options: any;
  clips: any;
  ffmpeg_job_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
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

  // Create a new job using the new edge function
  const createJob = async (jobData: {
    videoUrl: string;
    options: {
      captions: string;
      music: boolean;
      sfx: boolean;
    };
  }) => {
    if (!user) return null;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jobs-create', {
        body: jobData
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Handle synchronous completion
      if (data.status === 'completed' && data.clips) {
        toast({
          title: "Clips Generated!",
          description: `${data.clips.length} items are ready for download.`,
        });
        
        // No ongoing job to track for sync completion
        setCurrentJobId(null);
        setIsCanceled(false);
        
        // Refresh jobs list to show the completed job
        await fetchJobs();
        
        return data;
      }
      
      // Handle asynchronous processing
      if (data.jobId) {
        toast({
          title: "Job Created!",
          description: "Your video is now being processed. You'll see updates in real-time.",
        });

        // Set current job ID and reset canceled state for polling
        setCurrentJobId(data.jobId);
        setIsCanceled(false);

        // Refresh jobs list
        await fetchJobs();
        
        return data;
      }
      
      // Fallback case
      throw new Error("Unexpected response format from job creation");
      
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

      setJobs(data as Job[] || []);
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

  // Cancel job using the new edge function
  const cancelJob = async (jobId?: string) => {
    const jobToCancel = jobId || currentJobId;
    if (!jobToCancel) {
      // If no job to cancel, just reset state and return success
      setIsCanceled(true);
      setCurrentJobId(null);
      setIsLoading(false);
      return true;
    }

    try {
      console.log(`Canceling job: ${jobToCancel}`);
      
      const { data, error } = await supabase.functions.invoke('jobs-cancel', {
        body: { jobId: jobToCancel }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log(`Job ${jobToCancel} canceled successfully`);
      
      // Update local state immediately
      setIsCanceled(true);
      setCurrentJobId(null);
      setIsLoading(false);

      // Show cancellation toast
      toast({
        title: "Clip generation canceled",
        description: "You can start a new video now.",
        variant: "default",
      });

      // Refresh jobs list to reflect the change
      await fetchJobs();
      
      return true;
    } catch (error) {
      console.error('Error canceling job:', error);
      
      // Even if edge function fails, reset local state
      setIsCanceled(true);
      setCurrentJobId(null);
      setIsLoading(false);
      
      toast({
        title: "Job canceled locally",
        description: "The job was stopped in the interface. You can start a new video now.",
        variant: "default",
      });
      
      return true; // Return true to allow UI to proceed
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