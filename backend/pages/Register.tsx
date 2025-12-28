import React, { useState } from 'react';
import { MembershipCategory, BusinessCategory } from '../types';
import { CheckCircle, AlertCircle, Loader2, Eye, EyeOff, User, UploadCloud } from 'lucide-react';
import { api } from '../services/api';

interface RegisterProps {
  navigate: (page: string) => void;
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", 
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe", 
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", 
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", 
  "Taraba", "Yobe", "Zamfara"
];

const Register: React.FC<RegisterProps> = ({ navigate }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dob: '',
    gender: '', // Added Gender
    businessName: '',
    businessCommencement: '',
    businessAddress: '',
    businessCity: '',
    businessState: '',
    statesOfOperation: '',
    businessCategory: '',
    otherBusinessCategory: '', // Temp field for Other Category
    materialTypes: [] as string[],
    otherMaterialType: '', // Temp field for Other Material
    monthlyVolume: '',
    machineryDeployed: [] as string[],
    otherMachinery: '', // Temp field for Other Machinery
    employees: '',
    areasOfInterest: [] as string[],
    membershipCategory: '',
    relatedAssociation: 'No',
    relatedAssociationName: '',
    portraitImage: '', 
    // Document Uploads
    cacCertificate: '',
    businessLogo: '',
    businessEvidence: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({...prev, [name]: ''}));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      // @ts-ignore
      const list = prev[field] as string[];
      if (checked) {
        return { ...prev, [field]: [...list, value] };
      } else {
        return { ...prev, [field]: list.filter(item => item !== value) };
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
         alert("File is too large. Max 5MB allowed.");
         return;
      }

      if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800; // Reasonable width for docs
              const scaleSize = MAX_WIDTH / img.width;
              if (scaleSize < 1) {
                  canvas.width = MAX_WIDTH;
                  canvas.height = img.height * scaleSize;
              } else {
                  canvas.width = img.width;
                  canvas.height = img.height;
              }
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              // Aggressive compression: JPEG at 0.5 quality
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
              // @ts-ignore
              setFormData(prev => ({ ...prev, [field]: compressedDataUrl }));
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      } else {
          // For PDFs or non-images, check size stricter for localStorage
          if (file.size > 1024 * 1024) {
             alert("Warning: Large PDF files may fill local storage. Please use compressed files or images if possible.");
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            // @ts-ignore
            setFormData(prev => ({ ...prev, [field]: event.target?.result as string }));
          };
          reader.readAsDataURL(file);
      }
    }
  };

  const handlePortraitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          
          if (scaleSize < 1) {
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Compress to JPEG 0.5 for storage efficiency
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
          setFormData(prev => ({ ...prev, portraitImage: compressedDataUrl }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  };

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  };

  const validateStep1 = () => {
    const newErrors: {[key: string]: string} = {};

    if (!validateEmail(formData.email)) newErrors.email = "Please enter a valid email address.";
    if (!validatePhone(formData.phone)) newErrors.phone = "Phone number must contain 10-15 digits.";
    
    if (!validatePassword(formData.password)) {
      newErrors.password = "Password must be 8+ chars, include uppercase, lowercase, number, and special char.";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (!formData.firstName) newErrors.firstName = "First name is required.";
    if (!formData.lastName) newErrors.lastName = "Last name is required.";
    if (!formData.dob) newErrors.dob = "Date of birth is required.";
    if (!formData.gender) newErrors.gender = "Gender is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.businessName) newErrors.businessName = "Business name is required.";
    if (!formData.businessAddress) newErrors.businessAddress = "Address is required.";
    if (!formData.businessState) newErrors.businessState = "Primary state is required.";
    
    if (!formData.businessCategory) {
        newErrors.businessCategory = "Category is required.";
    } else if (formData.businessCategory === 'Other' && !formData.otherBusinessCategory) {
        newErrors.businessCategory = "Please specify the other category.";
    }

    // Validate Other Material
    if (formData.materialTypes.includes('Other') && !formData.otherMaterialType) {
        newErrors.materialTypes = "Please specify the other material.";
    }
    
    // Validate Other Machinery
    if (formData.machineryDeployed.includes('Other') && !formData.otherMachinery) {
        newErrors.machineryDeployed = "Please specify the other machinery.";
    }
    
    const empNum = Number(formData.employees);
    if (!formData.employees || isNaN(empNum) || empNum < 0) {
      newErrors.employees = "Please enter a valid number of employees.";
    }

    const volNum = parseFloat(formData.monthlyVolume);
    if (!formData.monthlyVolume || isNaN(volNum) || volNum < 0) {
      newErrors.monthlyVolume = "Please enter a valid numeric volume.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Logic to handle "Other" text inputs
    // 1. Materials
    let finalMaterials = [...formData.materialTypes];
    if (finalMaterials.includes('Other') && formData.otherMaterialType) {
        // Remove the string 'Other' and add the custom text
        finalMaterials = finalMaterials.filter(m => m !== 'Other');
        finalMaterials.push(formData.otherMaterialType);
    }
    
    // 2. Machinery
    let finalMachinery = [...formData.machineryDeployed];
    if (finalMachinery.includes('Other') && formData.otherMachinery) {
        // Remove the string 'Other' and add the custom text
        finalMachinery = finalMachinery.filter(m => m !== 'Other');
        finalMachinery.push(formData.otherMachinery);
    }

    // 3. Business Category
    let finalBusinessCategory = formData.businessCategory;
    if (finalBusinessCategory === 'Other' && formData.otherBusinessCategory) {
        finalBusinessCategory = formData.otherBusinessCategory;
    }

    // Structure documents properly
    const registrationPayload = {
      ...formData,
      materialTypes: finalMaterials,
      machineryDeployed: finalMachinery,
      businessCategory: finalBusinessCategory,
      category: formData.membershipCategory,
      profileImage: formData.portraitImage,
      documents: {
          cac: formData.cacCertificate,
          logo: formData.businessLogo,
          evidence: formData.businessEvidence
      }
    };

    // Clean up temporary fields before sending if needed, but the spread above captures them.
    // The backend receives extra fields but likely ignores them unless defined in schema, 
    // but our Mock backend stores everything, which is fine.

    try {
      await api.register(registrationPayload);
      alert(`Registration Successful! Please login with: ${formData.email}`);
      navigate('login');
    } catch (error: any) {
      if (error.message && error.message.includes('exists')) {
        alert('Registration Failed: A user with this email address already exists. Please login or use a different email.');
      } else if (error.message && error.message.includes('Validation')) {
         alert('Registration Failed: Please check your input fields for errors.');
      } else {
        alert(`Registration failed: ${error.message || 'Unknown error'}`);
      }
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const machineryOptions = ['Tricycle', 'Mintrucks', 'Baler', 'Crusher', 'Washing Line', 'Pelletizing Line', 'Manufacturing Line', 'None', 'Other'];
  const materialsOptions = ['PET Plastics', 'Other Plastics', 'Paper', 'Cartons', 'UBC', 'Metals', 'Other'];
  const interestOptions = ['Capacity Development', 'Access to Finance', 'Supply Chain', 'Compliance and Government', 'Community'];

  const getFees = (category: string) => {
    switch (category) {
      case MembershipCategory.CORPORATE: return '100,000 NGN';
      case MembershipCategory.PATRON: return '300,000 NGN';
      case MembershipCategory.ASSOCIATE: return '50,000 NGN';
      default: return 'Contact for details';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-green-700 px-6 py-4">
          <h2 className="text-2xl font-bold text-white">Membership Registration</h2>
          <p className="text-green-100 text-sm">Step {step} of 4</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Personal Information & Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input required name="firstName" value={formData.firstName} onChange={handleInputChange} type="text" className={`mt-1 block w-full rounded-md border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input required name="lastName" value={formData.lastName} onChange={handleInputChange} type="text" className={`mt-1 block w-full rounded-md border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input required name="phone" value={formData.phone} onChange={handleInputChange} type="tel" placeholder="+234..." className={`mt-1 block w-full rounded-md border ${errors.phone ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input required name="email" value={formData.email} onChange={handleInputChange} type="email" className={`mt-1 block w-full rounded-md border ${errors.email ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input required name="dob" value={formData.dob} onChange={handleInputChange} type="date" className={`mt-1 block w-full rounded-md border ${errors.dob ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                   {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center">
                            <input 
                                type="radio" 
                                name="gender" 
                                value="Male" 
                                checked={formData.gender === 'Male'} 
                                onChange={handleInputChange} 
                                className="mr-2 text-green-600 focus:ring-green-500"
                            /> Male
                        </label>
                        <label className="flex items-center">
                            <input 
                                type="radio" 
                                name="gender" 
                                value="Female" 
                                checked={formData.gender === 'Female'} 
                                onChange={handleInputChange} 
                                className="mr-2 text-green-600 focus:ring-green-500"
                            /> Female
                        </label>
                    </div>
                    {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-bold text-gray-700 mb-3">Create Password</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input 
                      required 
                      name="password" 
                      value={formData.password} 
                      onChange={handleInputChange} 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Min. 8 chars, Upper, Lower, Special"
                      className={`mt-1 block w-full rounded-md border ${errors.password ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} 
                    />
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                    <input 
                      required 
                      name="confirmPassword" 
                      value={formData.confirmPassword} 
                      onChange={handleInputChange} 
                      type={showPassword ? "text" : "password"} 
                      className={`mt-1 block w-full rounded-md border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} 
                    />
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="button" onClick={nextStep} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">Next: Business Info</button>
              </div>
            </div>
          )}

          {/* Step 2: Business Information */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Business Information</h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Registered Business Name</label>
                  <input required name="businessName" value={formData.businessName} onChange={handleInputChange} type="text" className={`mt-1 block w-full rounded-md border ${errors.businessName ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                  {errors.businessName && <p className="text-red-500 text-xs mt-1">{errors.businessName}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date of Commencement</label>
                    <input name="businessCommencement" value={formData.businessCommencement} onChange={handleInputChange} type="date" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business City</label>
                    <input name="businessCity" value={formData.businessCity} onChange={handleInputChange} type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Address</label>
                    <input required name="businessAddress" value={formData.businessAddress} onChange={handleInputChange} type="text" className={`mt-1 block w-full rounded-md border ${errors.businessAddress ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                    {errors.businessAddress && <p className="text-red-500 text-xs mt-1">{errors.businessAddress}</p>}
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-700">State of Operation (Primary)</label>
                    <select name="businessState" value={formData.businessState} onChange={handleInputChange} className={`mt-1 block w-full rounded-md border ${errors.businessState ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`}>
                      <option value="">Select State</option>
                      {NIGERIAN_STATES.map(state => (
                          <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    {errors.businessState && <p className="text-red-500 text-xs mt-1">{errors.businessState}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Additional States of Operation</label>
                  <input name="statesOfOperation" value={formData.statesOfOperation} onChange={handleInputChange} placeholder="e.g. Oyo, Edo" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500" />
                </div>
                
                {/* Business Category with Other */}
                <div>
                   <label className="block text-sm font-medium text-gray-700">Business Category</label>
                    <select name="businessCategory" value={formData.businessCategory} onChange={handleInputChange} className={`mt-1 block w-full rounded-md border ${errors.businessCategory ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`}>
                      <option value="">Select Category</option>
                      {Object.values(BusinessCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    {formData.businessCategory === 'Other' && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Please specify category:</label>
                            <input 
                                type="text" 
                                name="otherBusinessCategory"
                                value={formData.otherBusinessCategory} 
                                onChange={handleInputChange} 
                                placeholder="Enter your category"
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500" 
                            />
                        </div>
                    )}
                    {errors.businessCategory && <p className="text-red-500 text-xs mt-1">{errors.businessCategory}</p>}
                </div>

                {/* Materials with Other */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Materials Collected/Processed</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {materialsOptions.map(mat => (
                      <label key={mat} className="flex items-center space-x-2">
                        <input type="checkbox" value={mat} checked={formData.materialTypes.includes(mat)} onChange={(e) => handleCheckboxChange(e, 'materialTypes')} className="rounded text-green-600 focus:ring-green-500" />
                        <span className="text-sm text-gray-700">{mat}</span>
                      </label>
                    ))}
                  </div>
                  {formData.materialTypes.includes('Other') && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Please specify other material:</label>
                            <input 
                                type="text" 
                                name="otherMaterialType"
                                value={formData.otherMaterialType} 
                                onChange={handleInputChange} 
                                placeholder="e.g. Glass, E-waste"
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500" 
                            />
                            {errors.materialTypes && <p className="text-red-500 text-xs mt-1">{errors.materialTypes}</p>}
                        </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Monthly Volume (Tons)</label>
                    <input name="monthlyVolume" value={formData.monthlyVolume} onChange={handleInputChange} type="number" step="0.01" placeholder="e.g. 50" className={`mt-1 block w-full rounded-md border ${errors.monthlyVolume ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                    {errors.monthlyVolume && <p className="text-red-500 text-xs mt-1">{errors.monthlyVolume}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full-Time Employees</label>
                    <input name="employees" value={formData.employees} onChange={handleInputChange} type="number" min="0" className={`mt-1 block w-full rounded-md border ${errors.employees ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:border-green-500 focus:ring-green-500`} />
                    {errors.employees && <p className="text-red-500 text-xs mt-1">{errors.employees}</p>}
                  </div>
                </div>

                {/* Machinery with Other */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Machinery Deployed</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {machineryOptions.map(mach => (
                      <label key={mach} className="flex items-center space-x-2">
                        <input type="checkbox" value={mach} checked={formData.machineryDeployed.includes(mach)} onChange={(e) => handleCheckboxChange(e, 'machineryDeployed')} className="rounded text-green-600 focus:ring-green-500" />
                        <span className="text-sm text-gray-700">{mach}</span>
                      </label>
                    ))}
                  </div>
                  {formData.machineryDeployed.includes('Other') && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Please specify other machinery:</label>
                            <input 
                                type="text" 
                                name="otherMachinery"
                                value={formData.otherMachinery} 
                                onChange={handleInputChange} 
                                placeholder="e.g. Forklift, Extruder"
                                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500" 
                            />
                             {errors.machineryDeployed && <p className="text-red-500 text-xs mt-1">{errors.machineryDeployed}</p>}
                        </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <button type="button" onClick={() => setStep(1)} className="text-gray-600 hover:text-gray-800">Back</button>
                <button type="button" onClick={nextStep} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">Next: Membership</button>
              </div>
            </div>
          )}

          {/* Step 3: Membership Category & Uploads */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Membership & Documents</h3>
              
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Membership Category</label>
                <select required name="membershipCategory" value={formData.membershipCategory} onChange={handleInputChange} className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-green-500">
                  <option value="">Select Category</option>
                  {Object.values(MembershipCategory).map(cat => (
                    <option key={cat} value={cat}>{cat} - {getFees(cat)}</option>
                  ))}
                </select>
                {formData.membershipCategory && (
                  <p className="mt-2 text-sm text-amber-800 font-medium">
                    Selected Fee: {getFees(formData.membershipCategory)}
                  </p>
                )}
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Are you part of any other Recycling Association?</label>
                 <div className="flex space-x-4 mb-2">
                    <label className="flex items-center"><input type="radio" name="relatedAssociation" value="Yes" checked={formData.relatedAssociation === 'Yes'} onChange={handleInputChange} className="mr-2" /> Yes</label>
                    <label className="flex items-center"><input type="radio" name="relatedAssociation" value="No" checked={formData.relatedAssociation === 'No'} onChange={handleInputChange} className="mr-2" /> No</label>
                 </div>
                 {formData.relatedAssociation === 'Yes' && (
                     <input type="text" name="relatedAssociationName" value={formData.relatedAssociationName} onChange={handleInputChange} placeholder="Name of Association" className="w-full border rounded-md px-3 py-2" />
                 )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Areas of Interest</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {interestOptions.map(interest => (
                    <label key={interest} className="flex items-center space-x-2">
                      <input type="checkbox" value={interest} checked={formData.areasOfInterest.includes(interest)} onChange={(e) => handleCheckboxChange(e, 'areasOfInterest')} className="rounded text-green-600 focus:ring-green-500" />
                      <span className="text-sm text-gray-700">{interest}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-4">Required Documents & Profile</h4>
                <div className="space-y-4">
                  
                  {/* Portrait Upload Section */}
                  <div className="p-4 border-2 border-dashed border-green-200 rounded-lg bg-green-50">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                      <User className="w-4 h-4 mr-2" /> Portrait Picture (Profile Photo)
                    </label>
                    <div className="flex items-center space-x-4">
                       <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePortraitChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700" 
                       />
                       {formData.portraitImage && (
                         <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-green-600 flex-shrink-0">
                           <img src={formData.portraitImage} alt="Preview" className="h-full w-full object-cover" />
                         </div>
                       )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">This picture will be used as your profile image when you log in. Max size: 400px width.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 flex justify-between">
                        <span>CAC Registration Certificate</span>
                        {formData.cacCertificate && <span className="text-green-600 text-xs font-bold">File Selected</span>}
                    </label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'cacCertificate')} accept="image/*,.pdf" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 flex justify-between">
                        <span>Business Logo</span>
                        {formData.businessLogo && <span className="text-green-600 text-xs font-bold">File Selected</span>}
                    </label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'businessLogo')} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-700 flex justify-between">
                        <span>Evidence of Business Activity (Photo/Doc)</span>
                        {formData.businessEvidence && <span className="text-green-600 text-xs font-bold">File Selected</span>}
                    </label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'businessEvidence')} accept="image/*,.pdf" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button type="button" onClick={() => setStep(2)} className="text-gray-600 hover:text-gray-800">Back</button>
                <button type="button" onClick={() => setStep(4)} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">Review Application</button>
              </div>
            </div>
          )}

           {/* Step 4: Review */}
           {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Review Application</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p><span className="font-bold">Name:</span> {formData.firstName} {formData.lastName}</p>
                    <p><span className="font-bold">Email:</span> {formData.email}</p>
                    <p><span className="font-bold">Gender:</span> {formData.gender}</p>
                  </div>
                  {formData.portraitImage && (
                    <img src={formData.portraitImage} alt="Profile Preview" className="h-16 w-16 rounded-full object-cover border border-gray-300" />
                  )}
                </div>
                <p><span className="font-bold">Business:</span> {formData.businessName}</p>
                <p>
                    <span className="font-bold">Category:</span> {formData.businessCategory === 'Other' ? formData.otherBusinessCategory : formData.businessCategory}
                </p>
                <p><span className="font-bold">State:</span> {formData.businessState}</p>
                <p><span className="font-bold">Membership Type:</span> {formData.membershipCategory}</p>
                <p><span className="font-bold">Fee Due:</span> {getFees(formData.membershipCategory)}</p>
                <p><span className="font-bold">Monthly Volume:</span> {formData.monthlyVolume} Tons</p>
                <p><span className="font-bold">Employees:</span> {formData.employees}</p>
                
                <div className="border-t pt-2 mt-2">
                    <p className="font-bold text-xs text-gray-500 uppercase">Documents Attached:</p>
                    <div className="flex gap-2 mt-1">
                        {formData.cacCertificate ? <span className="text-xs bg-green-100 text-green-700 px-2 rounded">CAC Cert</span> : <span className="text-xs text-red-400">No CAC</span>}
                        {formData.businessLogo ? <span className="text-xs bg-green-100 text-green-700 px-2 rounded">Logo</span> : <span className="text-xs text-gray-400">No Logo</span>}
                        {formData.businessEvidence ? <span className="text-xs bg-green-100 text-green-700 px-2 rounded">Evidence</span> : <span className="text-xs text-red-400">No Evidence</span>}
                    </div>
                </div>
              </div>

              <div className="flex items-start space-x-2 bg-blue-50 p-4 rounded-md">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <p className="text-sm text-blue-700">By submitting, you agree to the RAN constitution and code of conduct. Your application will be reviewed by an administrator. Payment instructions will be provided upon initial approval.</p>
              </div>

              <div className="flex justify-between pt-4">
                <button type="button" onClick={() => setStep(3)} className="text-gray-600 hover:text-gray-800">Back</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`bg-green-600 text-white px-8 py-3 rounded-md hover:bg-green-700 font-bold shadow-lg flex items-center ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Register;