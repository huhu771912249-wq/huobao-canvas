export const nextSuggestionSetIndex = (currentIndex, totalSets) => {
  const total = Math.max(0, Number(totalSets) || 0)
  if (total <= 1) return 0
  return (Math.max(0, Number(currentIndex) || 0) + 1) % total
}
