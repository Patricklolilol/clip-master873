import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: string;
  thumbnails: any;
  statistics: any;
}

interface JobStatus {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
  clips?: any[];
  metadata?: VideoMetadata;
}

const ClipMaster = () => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const fetchMetadata = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('youtube-metadata', {
        body: { url: youtubeUrl }
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        return;
      }

      setMetadata(data.metadata);
      toast({
        title: "Metadata fetched successfully",
        description: `Video: ${data.metadata.title}`
      });
    } catch (err) {
      console.error('Error fetching metadata:', err);
      setError('❌ Failed to fetch video metadata');
    } finally {
      setIsLoading(false);
    }
  };

  const createClips = async () => {
    if (!metadata) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('jobs-create', {
        body: {
          videoUrl: youtubeUrl,
          options: {
            captions: 'modern',
            music: true,
            sfx: true
          }
        }
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        return;
      }

      setCurrentJob({
        jobId: data.jobId,
        status: data.status,
        stage: 'Queued',
        progress: 0,
        metadata: data.metadata
      });

      // Start polling for job status
      startPolling(data.jobId);

      toast({
        title: "Job created successfully",
        description: "Processing has started"
      });
    } catch (err) {
      console.error('Error creating job:', err);
      setError('❌ Failed to create clip generation job');
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('jobs-status', {
          body: {},
          method: 'GET'
        });

        // Get current session for auth
        const session = await supabase.auth.getSession();
        const response = await fetch(`https://pskxileirrvjnuiadfcd.supabase.co/functions/v1/jobs-status?jobId=${jobId}`, {
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        const statusData = await response.json();

        if (statusData.error) {
          setError(statusData.error);
          stopPolling();
          return;
        }

        setCurrentJob(statusData);

        // Stop polling if job is in final state
        const finalStates = ['completed', 'failed', 'cancelled'];
        if (finalStates.includes(statusData.status)) {
          stopPolling();
          
          if (statusData.status === 'completed') {
            toast({
              title: "Clips generated successfully!",
              description: `${statusData.clips?.length || 0} clips are ready for download`
            });
          } else if (statusData.status === 'failed') {
            setError('❌ Video processing failed. Please try another video');
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const cancelJob = async () => {
    if (!currentJob) return;

    try {
      const { data, error } = await supabase.functions.invoke('jobs-cancel', {
        body: { jobId: currentJob.jobId }
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        return;
      }

      stopPolling();
      setCurrentJob({ ...currentJob, status: 'cancelled', stage: 'Cancelled by user' });
      toast({
        title: "Job cancelled",
        description: "Processing has been stopped"
      });
    } catch (err) {
      console.error('Error cancelling job:', err);
      setError('❌ Failed to cancel job');
    }
  };

  const resetToNewVideo = () => {
    stopPolling();
    setYoutubeUrl('');
    setMetadata(null);
    setCurrentJob(null);
    setError(null);
    setIsLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'cancelled': return 'text-yellow-600';
      case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'cancelled': return <X className="h-5 w-5 text-yellow-600" />;
      default: return <Play className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Clip Master
          </h1>
          <p className="text-muted-foreground mt-2">
            Transform YouTube videos into engaging clips
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* URL Input Section */}
        {!currentJob && (
          <Card>
            <CardHeader>
              <CardTitle>Enter YouTube URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={fetchMetadata} 
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? 'Loading...' : 'Fetch Metadata'}
                </Button>
              </div>

              {metadata && (
                <div className="border rounded-lg p-4 bg-secondary/50">
                  <div className="flex items-start gap-4">
                    {metadata.thumbnails?.medium?.url && (
                      <img 
                        src={metadata.thumbnails.medium.url} 
                        alt="Video thumbnail"
                        className="w-32 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{metadata.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Duration: {metadata.duration} | Views: {metadata.statistics?.viewCount}
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={createClips} 
                    disabled={isLoading}
                    className="w-full mt-4"
                  >
                    {isLoading ? 'Creating Job...' : 'Create Clips'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job Progress Section */}
        {currentJob && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(currentJob.status)}
                  <span>Processing Status</span>
                </div>
                <div className="flex gap-2">
                  {!['completed', 'failed', 'cancelled'].includes(currentJob.status) && (
                    <Button onClick={cancelJob} variant="outline" size="sm">
                      Cancel
                    </Button>
                  )}
                  <Button onClick={resetToNewVideo} variant="outline" size="sm">
                    New Video
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentJob.metadata && (
                <div className="border rounded-lg p-4 bg-secondary/50">
                  <h3 className="font-semibold">{currentJob.metadata.title}</h3>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={getStatusColor(currentJob.status)}>
                    {currentJob.stage}
                  </span>
                  <span>{currentJob.progress}%</span>
                </div>
                <Progress value={currentJob.progress} className="w-full" />
              </div>

              {/* Clips Display */}
              {currentJob.clips && currentJob.clips.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Generated Clips</h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {currentJob.clips.map((clip: any, index: number) => (
                      <Card key={index} className="overflow-hidden">
                        <CardContent className="p-4">
                          {clip.thumbnail && (
                            <img 
                              src={clip.thumbnail} 
                              alt={`Clip ${index + 1}`}
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          )}
                          <h5 className="font-medium">{clip.title || `Clip ${index + 1}`}</h5>
                          <p className="text-sm text-muted-foreground">
                            Duration: {clip.duration}s
                          </p>
                          {clip.downloadUrl && (
                            <Button 
                              asChild 
                              variant="outline" 
                              size="sm" 
                              className="w-full mt-2"
                            >
                              <a href={clip.downloadUrl} download>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </a>
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClipMaster;