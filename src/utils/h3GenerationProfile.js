export const H3_DEFAULT_GENERATION_PROFILE = 'stable'

const FALLBACK_PROFILES = [
  {
    id: 'stable',
    name: '稳定生成',
    enabled: true,
    experimental: false,
    sampling_steps: 20
  },
  {
    id: 'turbo',
    name: '高速生成',
    enabled: false,
    experimental: true,
    sampling_steps: 4,
    disabled_reason: '服务器尚未安装并验证 T8 Turbo 工作流'
  }
]

export const getH3GenerationProfiles = (capability) => {
  const profiles = Array.isArray(capability?.profiles) ? capability.profiles : []
  const normalized = profiles
    .filter(profile => ['stable', 'turbo'].includes(String(profile?.id || '')))
    .map(profile => ({
      ...profile,
      id: String(profile.id),
      name: String(profile.name || profile.id),
      enabled: profile.id === 'stable' || profile.enabled === true
    }))
  return normalized.some(profile => profile.id === 'stable')
    ? normalized
    : FALLBACK_PROFILES.map(profile => ({ ...profile }))
}

export const isH3GenerationProfileEnabled = (capability, profileId) => {
  return getH3GenerationProfiles(capability).some(
    profile => profile.id === profileId && profile.enabled
  )
}

export const normalizeH3GenerationProfile = (value, capability) => {
  const profile = String(value || H3_DEFAULT_GENERATION_PROFILE).trim().toLowerCase()
  return isH3GenerationProfileEnabled(capability, profile)
    ? profile
    : H3_DEFAULT_GENERATION_PROFILE
}
