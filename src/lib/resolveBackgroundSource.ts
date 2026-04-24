export type BackgroundLoaderType = 'rgbe' | 'texture'

export function resolveBackgroundSource(url: string): BackgroundLoaderType {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  return ext === 'hdr' || ext === 'exr' ? 'rgbe' : 'texture'
}
