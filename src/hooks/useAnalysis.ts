
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface AnalyzeImageParams {
    imageFile: File;
    docId: number;
}

interface AddFaceParams {
    name: string;
    location: any;
    original_image_b64: string;
}

interface AddPersonParams {
    name: string;
    lang: string;
}

interface UpdateAbstractParams {
    doc_id: number;
    names: string[];
}

export function useAnalysis() {
    const queryClient = useQueryClient();

    const analyzeImageMutation = useMutation({
        mutationFn: async ({ imageFile, docId }: AnalyzeImageParams) => {
            const formData = new FormData();
            formData.append('image_file', imageFile, `${docId}.jpg`);

            return apiClient.post('/api/analyze_image', formData);
        },
    });

    const addFaceMutation = useMutation({
        mutationFn: async (params: AddFaceParams) => {
            return apiClient.post('/api/add_face', params);
        },
    });

    const addPersonMutation = useMutation({
        mutationFn: async (params: AddPersonParams) => {
            return apiClient.post('/api/add_person', params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['persons'] });
        },
    });

    const updateAbstractMutation = useMutation({
        mutationFn: async (params: UpdateAbstractParams) => {
            return apiClient.post('/api/update_abstract', params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
    });

    return {
        analyzeImage: analyzeImageMutation.mutateAsync,
        isAnalyzing: analyzeImageMutation.isPending,
        addFace: addFaceMutation.mutateAsync,
        isAddingFace: addFaceMutation.isPending,
        addPerson: addPersonMutation.mutateAsync,
        isAddingPerson: addPersonMutation.isPending,
        updateAbstract: updateAbstractMutation.mutateAsync,
        isUpdatingAbstract: updateAbstractMutation.isPending
    };
}
