<script setup>
import { onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'

const message = useMessage()
window.$message = message

onBeforeUnmount(() => {
  if (window.$message === message) {
    delete window.$message
  }
})
</script>

<template>
  <span class="hidden" aria-hidden="true"></span>
</template>
