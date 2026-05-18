<script setup lang="ts">
import LandingHeader from '@/components/landing/LandingHeader.vue'
import HeroSection from '@/components/landing/HeroSection.vue'
import FeaturesSection from '@/components/landing/FeaturesSection.vue'
import ArchitectureSection from '@/components/landing/ArchitectureSection.vue'
import ProtectionSection from '@/components/landing/ProtectionSection.vue'
import CtaSection from '@/components/landing/CtaSection.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import { useScrollEffects } from '@/composables/useScrollEffects'
import { useCardEffects } from '@/composables/useCardEffects'

const { isScrolled, activeSection } = useScrollEffects()
useCardEffects()
</script>

<template>
  <LandingHeader :is-scrolled="isScrolled" :active-section="activeSection" />
  <main id="main-content" role="main">
    <HeroSection />
    <FeaturesSection />
    <ArchitectureSection />
    <ProtectionSection />
    <CtaSection />
  </main>
  <LandingFooter />
</template>
