export interface PluggyIdentityRaw {
    id?: string;
    itemId?: string;
    fullName?: string | null;
    companyName?: string | null;
    document?: string | null;
    documentType?: string | null;
    taxNumber?: string | null;
    jobTitle?: string | null;
    birthDate?: string | null;
    emails?: Array<{ type?: string | null; value?: string | null }> | null;
    phoneNumbers?: Array<{ type?: string | null; value?: string | null }> | null;
    addresses?: Array<{
        type?: string | null;
        fullAddress?: string | null;
        primaryAddress?: string | null;
        city?: string | null;
        postalCode?: string | null;
        state?: string | null;
        country?: string | null;
    }> | null;
    updatedAt?: string | null;
}

export interface BankIdentitySource {
    itemId: string;
    institutionName: string;
    institutionSlug: string;
    fullName: string | null;
    documentMask: string | null;
    jobTitle: string | null;
    birthDate: string | null;
    emails: string[];
    phones: string[];
    cityState: string | null;
    updatedAt: string | null;
}

export interface ConsolidatedIdentityResult {
    fullName: string | null;
    birthDate: string | null;
    documentMask: string | null;
    jobTitle: string | null;
    emails: string[];
    phones: string[];
    addresses: Array<{
        fullAddress: string;
        city: string | null;
        state: string | null;
        postalCode: string | null;
        sourceBank: string;
    }>;
    bankSources: BankIdentitySource[];
    holderNames: string[];
    holderRawDocuments: string[];
}

function toTitleCaseName(name?: string | null): string | null {
    if (!name || !name.trim()) return null;
    const prepositions = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .split(' ')
        .map((w, idx) => (idx > 0 && prepositions.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
}

/**
 * Mascara os dígitos centrais do CPF por segurança: 123.456.789-01 -> ***.456.789-**
 */
export function maskCpfDocument(rawDoc?: string | null): string | null {
    if (!rawDoc) return null;
    const digits = rawDoc.replace(/\D/g, '');
    if (digits.length === 11) {
        return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    }
    if (digits.length === 14) {
        return `${digits.slice(0, 2)}.***.***/${digits.slice(8, 12)}-**`;
    }
    if (rawDoc.includes('*')) {
        return rawDoc.trim();
    }
    return null;
}

function formatBrPhone(rawPhone?: string | null): string | null {
    if (!rawPhone) return null;
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;

    // Remove DDI 55 se tiver 12 ou 13 dígitos
    const local = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
    if (local.length === 11) {
        return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
        return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
    return rawPhone.trim();
}

function pickConsensusValue(candidates: Array<string | null | undefined>): string | null {
    const valid = candidates.map((c) => (c || '').trim()).filter(Boolean);
    if (valid.length === 0) return null;

    const counts = new Map<string, { count: number; display: string }>();
    for (const item of valid) {
        const key = item
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const existing = counts.get(key);
        if (existing) {
            existing.count += 1;
            // Prefere a versão mais completa
            if (item.length > existing.display.length) {
                existing.display = item;
            }
        } else {
            counts.set(key, { count: 1, display: item });
        }
    }

    let best: { count: number; display: string } | null = null;
    for (const entry of counts.values()) {
        if (!best || entry.count > best.count || (entry.count === best.count && entry.display.length > best.display.length)) {
            best = entry;
        }
    }

    return best ? best.display : valid[0];
}

/**
 * Cruza os dados de /identity de todos os bancos conectados pelo usuário para formar
 * o Perfil Open Finance Consolidado com consenso de nome, nascimento, CPF mascarado,
 * profissão, contatos e discriminação por instituição.
 */
export function consolidateIdentityAcrossBanks(
    connections: Array<{
        itemId: string;
        institutionName: string;
        institutionSlug: string;
        identity: PluggyIdentityRaw | null;
        updatedAt?: string | null;
    }>
): ConsolidatedIdentityResult {
    const bankSources: BankIdentitySource[] = [];
    const nameCandidates: string[] = [];
    const birthCandidates: string[] = [];
    const docMaskCandidates: string[] = [];
    const jobCandidates: string[] = [];
    const emailCounts = new Map<string, number>();
    const phoneCounts = new Map<string, number>();
    const addresses: ConsolidatedIdentityResult['addresses'] = [];
    const holderNamesSet = new Set<string>();
    const holderDocsSet = new Set<string>();

    for (const conn of connections) {
        const idData = conn.identity;
        if (!idData) continue;

        const cleanName = toTitleCaseName(idData.fullName || idData.companyName);
        if (cleanName) {
            nameCandidates.push(cleanName);
            holderNamesSet.add(cleanName);
        }

        const rawDoc = idData.document || idData.taxNumber || null;
        if (rawDoc) {
            const digits = rawDoc.replace(/\D/g, '');
            if (digits.length >= 11) {
                holderDocsSet.add(digits);
            }
        }
        const maskedDoc = maskCpfDocument(rawDoc);
        if (maskedDoc) {
            docMaskCandidates.push(maskedDoc);
        }

        const birthDate = idData.birthDate ? idData.birthDate.split('T')[0] : null;
        if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
            birthCandidates.push(birthDate);
        }

        const cleanJob = idData.jobTitle ? toTitleCaseName(idData.jobTitle) : null;
        if (cleanJob && cleanJob.toLowerCase() !== 'outros' && cleanJob.toLowerCase() !== 'não informado') {
            jobCandidates.push(cleanJob);
        }

        const bankEmails: string[] = [];
        for (const em of idData.emails || []) {
            const val = (em?.value || '').trim().toLowerCase();
            if (val && val.includes('@')) {
                bankEmails.push(val);
                emailCounts.set(val, (emailCounts.get(val) || 0) + 1);
            }
        }

        const bankPhones: string[] = [];
        for (const ph of idData.phoneNumbers || []) {
            const formatted = formatBrPhone(ph?.value);
            if (formatted) {
                bankPhones.push(formatted);
                phoneCounts.set(formatted, (phoneCounts.get(formatted) || 0) + 1);
            }
        }

        let cityState: string | null = null;
        for (const addr of idData.addresses || []) {
            const fullAddr = (addr?.fullAddress || addr?.primaryAddress || '').trim();
            const city = addr?.city ? toTitleCaseName(addr.city) : null;
            const state = addr?.state ? addr.state.trim().toUpperCase() : null;
            if (city && state && !cityState) {
                cityState = `${city} - ${state}`;
            }
            if (fullAddr) {
                const alreadyAdded = addresses.some(
                    (a) => a.fullAddress.toLowerCase() === fullAddr.toLowerCase()
                );
                if (!alreadyAdded) {
                    addresses.push({
                        fullAddress: fullAddr,
                        city,
                        state,
                        postalCode: addr?.postalCode || null,
                        sourceBank: conn.institutionName,
                    });
                }
            }
        }

        bankSources.push({
            itemId: conn.itemId,
            institutionName: conn.institutionName,
            institutionSlug: conn.institutionSlug,
            fullName: cleanName,
            documentMask: maskedDoc,
            jobTitle: cleanJob,
            birthDate,
            emails: Array.from(new Set(bankEmails)),
            phones: Array.from(new Set(bankPhones)),
            cityState,
            updatedAt: idData.updatedAt || conn.updatedAt || null,
        });
    }

    const sortedEmails = Array.from(emailCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([email]) => email);

    const sortedPhones = Array.from(phoneCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([phone]) => phone);

    return {
        fullName: pickConsensusValue(nameCandidates),
        birthDate: pickConsensusValue(birthCandidates),
        documentMask: pickConsensusValue(docMaskCandidates),
        jobTitle: pickConsensusValue(jobCandidates),
        emails: sortedEmails,
        phones: sortedPhones,
        addresses,
        bankSources,
        holderNames: Array.from(holderNamesSet),
        holderRawDocuments: Array.from(holderDocsSet),
    };
}
