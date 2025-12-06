import { useEffect, useState, useRef } from 'react';
import firebaseService from '../services/firebaseService';


export const useProducts = (initialQuery = '') => {
const [products, setProducts] = useState([]);
const unsubscribeRef = useRef(null);
const [loading, setLoading] = useState(true);


useEffect(() => {
setLoading(true);
unsubscribeRef.current = firebaseService.fetchProducts((snapshot) => {
const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
setProducts(list);
setLoading(false);
});


return () => {
if (unsubscribeRef.current) unsubscribeRef.current();
};
}, [initialQuery]);


const refresh = () => {
// reattach

};


return { products, loading, refresh };
};