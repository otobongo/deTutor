import { getConfig, type MediaProviderName } from '@/lib/config';
import { GeminiProvider } from './gemini-provider';
import { PlaceholderProvider } from './placeholder-provider';
import type { MediaProvider } from './provider';

// The one import path for all media in the app: @/lib/media. Everything else
// in lib/media/ is internal (CI-guarded).

export type {
  AudioAsset,
  AudioSource,
  ImageAsset,
  ImageAssetKey,
  ImageSource,
  MediaProvider,
  VoiceConfig,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionEventType,
  VoiceSessionListener,
} from './provider';
export { MediaProviderError } from './provider';

const providers: Partial<Record<MediaProviderName, MediaProvider>> = {};

export function createMediaProvider(name: MediaProviderName): MediaProvider {
  return name === 'placeholder' ? new PlaceholderProvider() : new GeminiProvider();
}

export function getMediaProvider(): MediaProvider {
  const name = getConfig().mediaProvider;
  providers[name] ??= createMediaProvider(name);
  return providers[name];
}
