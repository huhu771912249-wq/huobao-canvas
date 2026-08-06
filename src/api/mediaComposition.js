import request from '../utils/request'

export const createMediaComposition = ({ videoUrl, audioUrl, subtitleText, segments }) => request({
  url: '/v1/media/compositions',
  method: 'post',
  data: {
    video_url: videoUrl,
    audio_url: audioUrl,
    subtitle_text: subtitleText,
    segments
  },
  timeout: 15 * 60 * 1000
})
