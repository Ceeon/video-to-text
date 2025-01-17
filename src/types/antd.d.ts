declare module 'antd/es/upload/interface' {
  export interface UploadFile {
    uid: string;
    name: string;
    status?: 'uploading' | 'done' | 'error' | 'removed';
    response?: any;
    originFileObj?: File;
  }
}

declare module 'antd' {
  import type { UploadFile } from 'antd/es/upload/interface';
  
  export const Button: React.FC<{
    type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
    loading?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children?: React.ReactNode;
  }>;

  export const Upload: React.FC<{
    fileList?: UploadFile[];
    onChange?: (info: { fileList: UploadFile[] }) => void;
    beforeUpload?: (file: File) => boolean;
    maxCount?: number;
    accept?: string;
    children?: React.ReactNode;
  }>;

  export const message: {
    success: (content: string) => void;
    error: (content: string) => void;
  };

  export type { UploadFile };
} 