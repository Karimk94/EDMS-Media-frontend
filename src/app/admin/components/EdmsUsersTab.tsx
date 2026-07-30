import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../context/ToastContext';
import { useTranslations } from '../../hooks/useTranslations';
import { InfiniteSelect } from '../../components/InfiniteSelect';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import * as XLSX from 'xlsx';

interface EdmsPerson {
    system_id: number;
    user_id: string;
    full_name: string;
    email_address: string;
    disabled: string;
    allow_login: string;
    primary_group: number;
    primary_group_name: string;
    secid: number;
    groups_count: number;
    hr_agencyid?: string;
    hr_departmentid?: string;
    hr_sectionid?: string;
}

interface HrEmployee {
    system_id: number;
    login: string;
    fullname_en: string;
    fullname_ar: string;
    email: string;
    agency: string;
    department: string;
    section: string;
    empno: string;
    agencyid: string;
    departmentid: string;
    sectionid: string;
}

interface Group {
    system_id: number;
    group_id: string;
    group_name: string;
}

export default function EdmsUsersTab() {
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const lang = user?.lang || 'en';
    const t = useTranslations(lang);

    // List State
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage] = useState(20);

    // HR Search Modal
    const [showHrSearchModal, setShowHrSearchModal] = useState(false);
    const [hrSearchQuery, setHrSearchQuery] = useState('');

    // Add User Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedHrEmployee, setSelectedHrEmployee] = useState<HrEmployee | null>(null);
    const [formData, setFormData] = useState({
        user_id: '',
        full_name: '',
        email: '',
        password_plain: '',
        primary_group: '',
        allow_login: 'Y',
        disabled: 'N',
        secid: '',
        network_aliases: '' as string,
        additional_groups: [] as string[],
    });

    // Sub-states for group selectors
    const [primaryGroupSearch, setPrimaryGroupSearch] = useState('');
    const [additionalGroupSearch, setAdditionalGroupSearch] = useState('');
    const [additionalGroupSelected, setAdditionalGroupSelected] = useState<string>('');

    // Sub-states for cascading HR selects
    const [selectedAgency, setSelectedAgency] = useState<string>('');
    const [selectedDept, setSelectedDept] = useState<string>('');

    // Read-only HR values from LKP_HR_EMPLOYEES
    const [hrAgencyDisplay, setHrAgencyDisplay] = useState<string>('');
    const [hrDepartmentDisplay, setHrDepartmentDisplay] = useState<string>('');
    const [hrSectionDisplay, setHrSectionDisplay] = useState<string>('');

    // Details/Edit Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editPerson, setEditPerson] = useState<EdmsPerson | null>(null);

    // Export State
    const [isExporting, setIsExporting] = useState(false);

    const clearServerCacheMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/admin/edocs/clear-cache', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Failed to start server cache refresh');
            }

            return data;
        },
        onSuccess: (data) => {
            const cacheRoot = data.server_cache_root ? ` (${data.server_cache_root})` : '';
            showToast(`Server eDOCS cache refresh started${cacheRoot}`, 'success');
        },
        onError: (err: any) => {
            showToast(err.message || 'Failed to start server cache refresh', 'error');
        },
    });

    // Export to Excel function (using optimized backend endpoint)
    const handleExportToExcel = async () => {
        setIsExporting(true);
        try {
            showToast('Preparing export...', 'info');

            // Build params - include search if active
            const params = new URLSearchParams();
            if (searchQuery.length >= 3) {
                params.append('search', searchQuery);
            }

            // Fetch all export data from optimized endpoint
            const response = await fetch(`/api/edms-people/export?${params}`, { credentials: 'include' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch export data');
            }

            const exportData = await response.json();

            if (exportData.length === 0) {
                showToast('No users found to export', 'error');
                setIsExporting(false);
                return;
            }

            // Create Excel workbook
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'EDMS Users');

            // Set column widths
            const colWidths = [
                { wch: 20 }, // Username
                { wch: 30 }, // Full Name
                { wch: 35 }, // Email
                { wch: 20 }, // Last Login Date
                { wch: 40 }, // Groups
                { wch: 40 }, // Agency - Department - Section
                { wch: 15 }, // Service User
                { wch: 15 }, // Allow Login
                { wch: 15 }  // Disabled
            ];
            worksheet['!cols'] = colWidths;

            // Generate filename with date
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            const filename = `edms-users-export-${dateStr}.xlsx`;

            // Trigger download
            XLSX.writeFile(workbook, filename);

            showToast(`Successfully exported ${exportData.length} users to ${filename}`, 'success');
        } catch (err: any) {
            console.error('Export error:', err);
            showToast(err.message || 'Failed to export users', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
    const debouncedHrSearchQuery = useDebouncedValue(hrSearchQuery, 300);

    // Fetch EDMS Users
    const { data: usersData, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['edms-people', currentPage, debouncedSearchQuery],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(perPage)
            });
            if (debouncedSearchQuery.length >= 3) {
                params.append('search', debouncedSearchQuery);
            }
            const response = await fetch(`/api/edms-people?${params}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch EDMS people');
            return response.json();
        },
        enabled: debouncedSearchQuery.length === 0 || debouncedSearchQuery.length >= 3,
        placeholderData: (previousData) => previousData, // keepPreviousData for smooth pagination
    });

    // Fetch HR Employees
    const { data: hrEmployees, isLoading: isLoadingHr } = useQuery({
        queryKey: ['hr-employees', debouncedHrSearchQuery],
        queryFn: async () => {
            if (debouncedHrSearchQuery.length < 3) return [];
            const response = await fetch(`/api/edms-people/hr-employees?search=${encodeURIComponent(debouncedHrSearchQuery)}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch HR employees');
            return response.json();
        },
        enabled: debouncedHrSearchQuery.length >= 3,
    });

    // Fetch Groups
    const { data: groups } = useQuery({
        queryKey: ['edms-groups'],
        queryFn: async () => {
            const response = await fetch('/api/edms-people/groups', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch groups');
            return response.json();
        },
    });

    // Cascading dropdown fetches
    const { data: agencies } = useQuery({
        queryKey: ['hr-agencies'],
        queryFn: async () => {
            const res = await fetch('/api/edms-people/hr/agencies', { credentials: 'include' });
            if (!res.ok) return [];
            return res.json();
        }
    });

    const { data: departments } = useQuery({
        queryKey: ['hr-departments', selectedAgency],
        queryFn: async () => {
            if (!selectedAgency) return [];
            const res = await fetch(`/api/edms-people/hr/departments?agency_id=${selectedAgency}`, { credentials: 'include' });
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!selectedAgency,
    });

    const { data: sections } = useQuery({
        queryKey: ['hr-sections', selectedDept],
        queryFn: async () => {
            if (!selectedDept) return [];
            const res = await fetch(`/api/edms-people/hr/sections?dept_id=${selectedDept}`, { credentials: 'include' });
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!selectedDept,
    });

    // Fetch User Details for Edit
    const { data: personDetails, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['edms-person-details', editPerson?.system_id],
        queryFn: async () => {
            if (!editPerson) return null;
            const response = await fetch(`/api/edms-people/${editPerson.system_id}/details`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch person details');
            return response.json();
        },
        enabled: !!editPerson,
    });

    // Populate Edit Form once details load
    const startEdit = (person: EdmsPerson) => {
        setEditPerson(person);

        let foundAgency = agencies?.find((a: any) => a.system_id == person.hr_agencyid)?.system_id || '';
        let foundDept = person.hr_departmentid && !isNaN(parseInt(person.hr_departmentid)) ? person.hr_departmentid : '';
        let foundSection = person.hr_sectionid && !isNaN(parseInt(person.hr_sectionid)) ? person.hr_sectionid : '';

        setSelectedAgency(foundAgency.toString());
        setTimeout(() => setSelectedDept(foundDept.toString()), 100);
        setTimeout(() => setFinalSectionId(foundSection.toString()), 200);

        setShowEditModal(true);
    };

    if (personDetails && editPerson && showEditModal && !formData.user_id) {
        // Populate HR display values from personDetails if available
        const hrAgency = personDetails.agency || '';
        const hrDept = personDetails.department || '';
        const hrSection = personDetails.section || '';

        setHrAgencyDisplay(hrAgency);
        setHrDepartmentDisplay(hrDept);
        setHrSectionDisplay(hrSection);

        setFormData({
            ...formData,
            user_id: personDetails.aliases?.[0]?.network_id?.split('\\')[1] || editPerson.user_id || '', // fallback
            full_name: editPerson.full_name || '',
            email: editPerson.email_address || '',
            password_plain: '', // Don't pre-fill passwords
            primary_group: editPerson.primary_group?.toString() || '',
            allow_login: editPerson.allow_login || 'Y',
            disabled: editPerson.disabled || 'N',
            secid: editPerson.secid?.toString() || '',
            network_aliases: personDetails.aliases?.map((a: any) => a.network_id).join('\n') || '',
            additional_groups: personDetails.groups
                ?.filter((g: any) => g.system_id !== editPerson.primary_group)
                .map((g: any) => g.system_id.toString()) || []
        });

        // We do not strict-resolve secid backwards into Agency -> Dept -> Section automatically here,
        // because EDMS base stores a single SECID. However, the user can change it via the dropdowns now.
    }

    // Effect: Update SECID when cascading dropdowns change
    const [finalSectionId, setFinalSectionId] = useState<string>('');
    const updateSecIdFromHierarchy = (sId: string) => {
        setFormData(prev => ({ ...prev, secid: sId || selectedDept || selectedAgency || prev.secid }));
        setFinalSectionId(sId);
    };

    // Effect: Automatically update network aliases when HrLogin/user_id changes on creation
    useEffect(() => {
        if (showAddModal && formData.user_id) {
            setFormData(prev => ({ ...prev, network_aliases: `RTADOM\\${formData.user_id}` }));
        }
    }, [formData.user_id, showAddModal]);

    // Handle adding additional group from InfiniteSelect
    useEffect(() => {
        if (additionalGroupSelected) {
            if (!formData.additional_groups.includes(additionalGroupSelected)) {
                setFormData(prev => ({ ...prev, additional_groups: [...prev.additional_groups, additionalGroupSelected] }));
            }
            setAdditionalGroupSelected(''); // reset selector
        }
    }, [additionalGroupSelected, formData.additional_groups]);

    const removeAdditionalGroup = (gId: string) => {
        setFormData(prev => ({ ...prev, additional_groups: prev.additional_groups.filter(id => id !== gId) }));
    };

    // Mutations
    const addMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                user_id: formData.user_id,
                full_name: formData.full_name,
                email: formData.email,
                password_plain: formData.password_plain,
                primary_group: parseInt(formData.primary_group) || 0,
                allow_login: formData.allow_login,
                disabled: formData.disabled,
                secid: 0,
                additional_groups: formData.additional_groups.map(g => parseInt(g)).filter(Boolean),
                network_aliases: formData.network_aliases.split('\n').filter(a => a.trim()),
                hr_login: selectedHrEmployee?.login,
                hr_empno: selectedHrEmployee?.empno
            };
            const response = await fetch('/api/edms-people', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to create user');
            }
            return response.json();
        },
        onSuccess: () => {
            showToast('User successfully created', 'success');
            resetForms();
            setCurrentPage(1);
            queryClient.invalidateQueries({ queryKey: ['edms-people'] });
        },
        onError: (err: any) => showToast(err.message, 'error'),
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editPerson) return;
            const payload = {
                full_name: formData.full_name,
                email: formData.email,
                password_plain: formData.password_plain || undefined,
                primary_group: parseInt(formData.primary_group) || 0,
                allow_login: formData.allow_login,
                disabled: formData.disabled,
                secid: 0,
                additional_groups: formData.additional_groups.map(g => parseInt(g)).filter(Boolean),
                network_aliases: formData.network_aliases.split('\n').filter(a => a.trim()),
            };
            const response = await fetch(`/api/edms-people/${editPerson.system_id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to update user');
            }
            return response.json();
        },
        onSuccess: () => {
            showToast('User successfully updated', 'success');
            resetForms();
            setCurrentPage(1);
            queryClient.invalidateQueries({ queryKey: ['edms-people'] });
            queryClient.invalidateQueries({ queryKey: ['edms-person-details'] });
        },
        onError: (err: any) => showToast(err.message, 'error'),
    });

    const handleHrSelect = (emp: HrEmployee) => {
        setSelectedHrEmployee(emp);

        let foundAgencyId = emp.agencyid;
        let foundDeptId = emp.departmentid;
        let foundSectionId = emp.sectionid;

        // Ensure we handle potential string/numeric mismatches by using the agencies list to verify
        const matchedAgency = agencies?.find((a: any) => String(a.system_id) === String(foundAgencyId));
        const finalAgency = matchedAgency ? String(matchedAgency.system_id) : String(foundAgencyId || '');

        setSelectedAgency(finalAgency);
        // Store read-only values from HR employee record
        setHrAgencyDisplay(emp.agency || '');
        setHrDepartmentDisplay(emp.department || '');
        setHrSectionDisplay(emp.section || '');

        // Cascading setters with slight delay to ensure TanStack Query / React state settles
        setTimeout(() => setSelectedDept(String(foundDeptId || '')), 100);
        setTimeout(() => setFinalSectionId(String(foundSectionId || '')), 200);

        setFormData({
            ...formData,
            user_id: emp.login || '',
            full_name: emp.fullname_en || '',
            email: emp.email || '',
            secid: emp.sectionid || emp.departmentid || emp.agencyid || '',
            network_aliases: emp.login ? `RTADOM\\${emp.login}` : '',
            primary_group: '',
            additional_groups: [],
            password_plain: ''
        });
        setShowHrSearchModal(false);
        setShowAddModal(true);
    };

    const resetForms = () => {
        setShowHrSearchModal(false);
        setShowAddModal(false);
        setShowEditModal(false);
        setSelectedHrEmployee(null);
        setEditPerson(null);
        setSelectedAgency('');
        setSelectedDept('');
        setFinalSectionId('');
        setHrAgencyDisplay('');
        setHrDepartmentDisplay('');
        setHrSectionDisplay('');
        setFormData({
            user_id: '', full_name: '', email: '', password_plain: '', primary_group: '',
            allow_login: 'Y', disabled: 'N', secid: '', network_aliases: '', additional_groups: []
        });
    };

    // Prepare group options
    const groupOptions = (groups || []).filter((g: any) => {
        const query = primaryGroupSearch.toLowerCase();
        return (g.group_name || '').toLowerCase().includes(query) || (g.group_id || '').toLowerCase().includes(query);
    }).map((g: any) => ({
        label: g.group_name || g.group_id,
        sublabel: g.group_id,
        value: g.system_id.toString()
    }));

    const additionalGroupOptions = (groups || [])
        .filter((g: any) => !formData.additional_groups.includes(g.system_id.toString()) && g.system_id.toString() !== formData.primary_group)
        .filter((g: any) => {
            const query = additionalGroupSearch.toLowerCase();
            return (g.group_name || '').toLowerCase().includes(query) || (g.group_id || '').toLowerCase().includes(query);
        })
        .map((g: any) => ({
            label: g.group_name || g.group_id,
            sublabel: g.group_id,
            value: g.system_id.toString()
        }));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showHrSearchModal) {
                    setShowHrSearchModal(false);
                } else if (showAddModal || showEditModal) {
                    resetForms();
                }
            }
        };

        if (showHrSearchModal || showAddModal || showEditModal) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showHrSearchModal, showAddModal, showEditModal]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-6">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">EDMS Users Management</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage base EDMS accounts and assign users from HR directory.</p>
                </div>
                <button
                    type="button"
                    onClick={() => clearServerCacheMutation.mutate()}
                    disabled={clearServerCacheMutation.isPending}
                    title="Refresh server eDOCS cache"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {clearServerCacheMutation.isPending ? (
                        <Spinner size="sm" />
                    ) : (
                        <Image src="/icons/refresh.svg" alt="" width={16} height={16} className="h-4 w-4 invert" />
                    )}
                    <span hidden>{clearServerCacheMutation.isPending ? 'Refreshing...' : 'Refresh Cache'}</span>
                </button>
            </div>

            <div className="mb-6">
                <button
                    onClick={() => setShowHrSearchModal(true)}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                    + Add EDMS User
                </button>
            </div>

            {/* Main List */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center bg-gray-50 dark:bg-gray-900/50">
                    <input
                        type="text"
                        placeholder="Search users (min 3 chars)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                        onClick={() => setCurrentPage(1)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Refresh
                    </button>
                    <button
                        onClick={handleExportToExcel}
                        disabled={isExporting}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <Spinner size="sm" />
                                <span>Exporting...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Export to Excel</span>
                            </>
                        )}
                    </button>
                </div>

                {isLoadingUsers ? (
                    <div className="p-8 text-center text-gray-500"><Spinner size="md" center /></div>
                ) : usersData?.users?.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-white dark:bg-gray-800">No users found.</div>
                ) : (
                    <div className="overflow-x-auto bg-white dark:bg-gray-800">
                        <table className="w-full text-left text-sm table-fixed">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="px-3 py-3 font-semibold w-32">User ID</th>
                                    <th className="px-3 py-3 font-semibold w-44">Full Name</th>
                                    <th className="px-3 py-3 font-semibold w-48">Email</th>
                                    <th className="px-3 py-3 font-semibold w-40">Primary Group</th>
                                    <th className="px-3 py-3 font-semibold w-36">Status</th>
                                    <th className="px-3 py-3 font-semibold w-16 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                {usersData?.users.map((user: EdmsPerson) => (
                                    <tr key={user.system_id} onDoubleClick={() => startEdit(user)} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition select-none">
                                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white truncate">{user.user_id}</td>
                                        <td className="px-3 py-3 dark:text-gray-300 truncate">{user.full_name}</td>
                                        <td className="px-3 py-3 text-gray-500 dark:text-gray-400 truncate">{user.email_address}</td>
                                        <td className="px-3 py-3 dark:text-gray-300 truncate">
                                            {user.primary_group_name || 'None'}
                                            {user.groups_count > 1 && <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full inline-block">+{user.groups_count - 1}</span>}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex flex-wrap items-center gap-1">
                                                <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap font-medium ${user.disabled === 'N' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                                    {user.disabled === 'N' ? 'Active' : 'Disabled'}
                                                </span>
                                                {(!user.allow_login || user.allow_login === 'N') && (
                                                    <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 rounded-full whitespace-nowrap font-medium">
                                                        No Login
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-800">
                    <button onClick={() => setCurrentPage(c => Math.max(1, c - 1))} disabled={currentPage === 1} className="disabled:opacity-50 text-blue-600 dark:text-blue-400">Previous</button>
                    <span className="text-sm dark:text-gray-400">Page {currentPage}</span>
                    <button onClick={() => setCurrentPage(c => c + 1)} disabled={!usersData?.has_more} className="disabled:opacity-50 text-blue-600 dark:text-blue-400">Next</button>
                </div>
            </div>

            {/* Modal: HR Search */}
            {showHrSearchModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowHrSearchModal(false); }}
                >
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h2 className="text-2xl font-bold dark:text-white">Select HR Employee</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Search the HR directory for users not yet in EDMS</p>
                        </div>
                        <div className="p-6 flex flex-col gap-4 flex-1 overflow-auto">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by name, login, or email (min 3 chars)..."
                                value={hrSearchQuery}
                                onChange={(e) => setHrSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 dark:text-white"
                            />

                            {isLoadingHr ? <Spinner center size="sm" /> :
                                hrEmployees?.length > 0 ? (
                                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                        {hrEmployees.map((emp: HrEmployee) => (
                                            <li key={emp.system_id} onClick={() => handleHrSelect(emp)} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center transition">
                                                <div>
                                                    <div className="font-medium dark:text-white">{emp.fullname_en}</div>
                                                    <div className="text-sm text-gray-500">{emp.login} | {emp.email}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{emp.agency} / {emp.department}</div>
                                                </div>
                                                <div className="text-blue-600 pointer-events-none p-2 border border-blue-200 rounded-lg text-sm bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800 font-medium">Select</div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : hrSearchQuery.length >= 3 ? (
                                    <div className="text-center p-8 text-gray-500">No matching employees found not already in EDMS.</div>
                                ) : null}
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-right bg-gray-50 dark:bg-gray-800">
                            <button onClick={() => setShowHrSearchModal(false)} className="px-6 py-2 bg-gray-300 dark:bg-gray-600 rounded text-gray-800 dark:text-white">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add / Edit User Form */}
            {(showAddModal || showEditModal) && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) resetForms(); }}
                >
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                            <h2 className="text-2xl font-bold dark:text-white">
                                {showAddModal ? 'Create EDMS User' : `Edit User: ${formData.user_id}`}
                            </h2>
                            {showAddModal && selectedHrEmployee && (
                                <span className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded">
                                    From HR: {selectedHrEmployee.fullname_en}
                                </span>
                            )}
                        </div>

                        {(showEditModal && isLoadingDetails) ? (
                            <div className="p-12"><Spinner center /></div>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); showAddModal ? addMutation.mutate() : updateMutation.mutate(); }} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Column 1 */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">Basic Info</h3>
                                        <div>
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Username (USER_ID) *</label>
                                            <input required disabled={showEditModal} value={formData.user_id} onChange={e => setFormData({ ...formData, user_id: e.target.value.toUpperCase() })} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Full Name *</label>
                                            <input required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
                                            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                Password {showEditModal && "(Leave blank to keep unchanged)"}
                                            </label>
                                            <input
                                                type="password"
                                                value={formData.password_plain}
                                                onChange={e => setFormData({ ...formData, password_plain: e.target.value })}
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                            />
                                        </div>

                                        <h3 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 pt-4">Meta (Assignment)</h3>

                                        <div>
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Agency</label>
                                            <div className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800/80 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                                {hrAgencyDisplay || '—'}
                                            </div>
                                        </div>
                                        {hrDepartmentDisplay && (
                                            <div>
                                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Department</label>
                                                <div className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800/80 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                                    {hrDepartmentDisplay || '—'}
                                                </div>
                                            </div>
                                        )}
                                        {hrSectionDisplay && (
                                            <div>
                                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Section</label>
                                                <div className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800/80 dark:border-gray-700 text-gray-900 dark:text-gray-300">
                                                    {hrSectionDisplay || '—'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Column 2 */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">Access & Groups</h3>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={formData.allow_login === 'Y'} onChange={e => setFormData({ ...formData, allow_login: e.target.checked ? 'Y' : 'N' })} className="rounded" />
                                                <span className="text-sm dark:text-gray-300">Allow Login</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={formData.disabled === 'Y'} onChange={e => setFormData({ ...formData, disabled: e.target.checked ? 'Y' : 'N' })} className="rounded" />
                                                <span className="text-sm dark:text-gray-300 text-red-500">Account Disabled</span>
                                            </label>
                                        </div>

                                        <div className="z-20 relative">
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Primary Group *</label>
                                            <InfiniteSelect
                                                t={t}
                                                options={groupOptions}
                                                value={formData.primary_group}
                                                onChange={val => setFormData({ ...formData, primary_group: val })}
                                                placeholder="Search and Select Group..."
                                                onSearch={setPrimaryGroupSearch}
                                                searchValue={primaryGroupSearch}
                                            />
                                        </div>

                                        <div className="z-10 relative mt-4">
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Additional Groups</label>
                                            <InfiniteSelect
                                                t={t}
                                                options={additionalGroupOptions}
                                                value={additionalGroupSelected}
                                                onChange={setAdditionalGroupSelected}
                                                placeholder="Search to Add Groups..."
                                                onSearch={setAdditionalGroupSearch}
                                                searchValue={additionalGroupSearch}
                                            />

                                            {/* Badges container */}
                                            {formData.additional_groups.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {formData.additional_groups.map(gId => {
                                                        const matchingGroup = groups?.find((g: any) => g.system_id.toString() === gId);
                                                        const gName = matchingGroup?.group_name || matchingGroup?.group_id || gId;
                                                        return (
                                                            <div key={`badg_${gId}`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                                                                <span>{gName}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeAdditionalGroup(gId)}
                                                                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition"
                                                                >
                                                                    &times;
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4">
                                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Network Aliases</label>
                                            <textarea
                                                rows={2}
                                                disabled
                                                value={formData.network_aliases}
                                                placeholder="Auto-generated on creation"
                                                className="w-full p-2 border rounded bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-500 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex justify-end gap-4 mt-6">
                                    <button type="button" onClick={resetForms} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded font-medium hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                                    <button type="submit" disabled={!formData.primary_group || addMutation.isPending || updateMutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                                        {(addMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save User'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
