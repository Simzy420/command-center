export interface GradientPreview {
  kind: 'gradient';
  colors: string[];
  seed: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  preview: GradientPreview;
  createdAt: number;
  provider: string;
}

export interface ImageGenInput {
  prompt: string;
  count: number;
}

/** Swap this implementation for a real provider later. */
export interface ImageGenAdapter {
  id: string;
  label: string;
  generate(input: ImageGenInput): Promise<GeneratedImage[]>;
}
