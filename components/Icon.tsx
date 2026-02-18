import React from 'react';
import { 
  Receipt, 
  Utensils, 
  Hotel, 
  Bus, 
  ShoppingBag, 
  Ticket,
  MoreHorizontal, 
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Camera,
  Home,
  MapPin,
  PieChart,
  Settings,
  User,
  Gift,
  ChevronRight,
  Download,
  Pencil,
  FileText,
  FileSpreadsheet,
  Presentation,
  X,
  Plane,
  ChevronDown,
  LogOut,
  Cloud,
  Crown,
  Shield,
  Mail,
  Lock,
  Calculator,
  Info,
  RefreshCw,
  Calendar // Added Calendar
} from 'lucide-react';
import { Category } from '../types';

export const CategoryIcon = ({ category, className = "w-5 h-5" }: { category: Category; className?: string }) => {
  switch (category) {
    case '식비': return <Utensils className={className} />;
    case '숙소': return <Hotel className={className} />;
    case '교통': return <Bus className={className} />;
    case '쇼핑': return <ShoppingBag className={className} />;
    case '관광': return <Ticket className={className} />;
    case '기타': 
    default: return <MoreHorizontal className={className} />;
  }
};

export const Icons = {
  Receipt,
  Utensils, // Added Utensils to Icons object
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Camera,
  Home,
  MapPin,
  PieChart,
  Settings,
  User,
  Gift,
  ChevronRight,
  Download,
  Pencil,
  FileText,
  FileSpreadsheet,
  Presentation,
  X,
  Plane,
  ChevronDown,
  LogOut,
  Cloud,
  Crown,
  Shield,
  Mail,
  Lock,
  Ticket,
  Calculator,
  Info,
  RefreshCw,
  Calendar // Added Calendar
};