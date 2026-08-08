import request from '../utils/request'

export const createMediaComposition = ({ videoUrl, audioUrl, subtitleText, segments, qualityProfile }) => request({
  url: '/v1/media/compositions',
  method: 'post',
  data: {
    video_url: videoUrl,
    audio_url: audioUrl,
    subtitle_text: subtitleText,
    segments,
    ...(qualityProfile ? { quality_profile: qualityProfile } : {})
  },
  timeout: 15 * 60 * 1000
})
