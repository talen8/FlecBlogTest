export function useExpandable(initialState = false) {
  const isExpanded = ref(initialState);
  const toggleExpand = () => (isExpanded.value = !isExpanded.value);
  return { isExpanded, toggleExpand };
}
